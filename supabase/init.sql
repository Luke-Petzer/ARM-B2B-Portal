-- ============================================================
-- B2B Ordering Portal — Normalized Database Schema v2
-- ============================================================
-- Run in Supabase SQL Editor -> New Query -> Run
-- SAFE TO RE-RUN: full teardown at the top.
-- ============================================================


-- ============================================================
-- PHASE 0: TEARDOWN
-- ============================================================

-- Must drop auth.users trigger manually (external schema)
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

-- Drop tables in reverse dependency order (CASCADE handles triggers/policies)
DROP TABLE IF EXISTS public.global_settings        CASCADE;
DROP TABLE IF EXISTS public.audit_log              CASCADE;
DROP TABLE IF EXISTS public.buyer_sessions         CASCADE;
DROP TABLE IF EXISTS public.payments               CASCADE;
DROP TABLE IF EXISTS public.order_status_history   CASCADE;
DROP TABLE IF EXISTS public.order_items            CASCADE;
DROP TABLE IF EXISTS public.orders                 CASCADE;
DROP TABLE IF EXISTS public.addresses              CASCADE;
DROP TABLE IF EXISTS public.product_images         CASCADE;
DROP TABLE IF EXISTS public.products               CASCADE;
DROP TABLE IF EXISTS public.categories             CASCADE;
DROP TABLE IF EXISTS public.profiles               CASCADE;
DROP TABLE IF EXISTS public.tenant_config          CASCADE;

DROP SEQUENCE IF EXISTS public.order_seq;

DROP FUNCTION IF EXISTS public.get_app_role()                  CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()                      CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at()             CASCADE;
DROP FUNCTION IF EXISTS public.validate_line_total()           CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_admin_user()         CASCADE;
DROP FUNCTION IF EXISTS public.generate_order_reference()      CASCADE;
DROP FUNCTION IF EXISTS public.record_order_status_change()    CASCADE;
DROP FUNCTION IF EXISTS public.log_table_audit()               CASCADE;

DROP TYPE IF EXISTS public.app_role        CASCADE;
DROP TYPE IF EXISTS public.order_status    CASCADE;
DROP TYPE IF EXISTS public.payment_method  CASCADE;
DROP TYPE IF EXISTS public.payment_status  CASCADE;
DROP TYPE IF EXISTS public.address_type    CASCADE;


-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE public.app_role AS ENUM (
  'admin',
  'buyer_default',
  'buyer_30_day'
);

CREATE TYPE public.order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'fulfilled',
  'cancelled'
);

CREATE TYPE public.payment_method AS ENUM (
  'eft',
  '30_day_account'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'verified',
  'rejected'
);

CREATE TYPE public.address_type AS ENUM (
  'billing',
  'shipping'
);


-- ============================================================
-- SEQUENCE: human-readable order references
-- ============================================================

CREATE SEQUENCE public.order_seq START 1;


-- ============================================================
-- HELPER FUNCTIONS (must precede RLS policies)
-- ============================================================

-- Reads app_role claim from the current request JWT
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'app_role')::public.app_role;
$$;

-- Returns true if the current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_app_role() = 'admin';
$$;

-- Generates a sequential human-readable order reference: ORD-000001
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'ORD-' || LPAD(NEXTVAL('public.order_seq')::TEXT, 6, '0');
$$;


-- ============================================================
-- TABLE: tenant_config
-- ============================================================
-- Singleton row (id must always be 1).
-- Stores supplier branding, bank details, and email config.
-- Admins update this via the admin dashboard settings page.

CREATE TABLE public.tenant_config (
  id                    INT           PRIMARY KEY DEFAULT 1,
  -- Branding
  business_name         TEXT          NOT NULL DEFAULT 'My Business',
  trading_name          TEXT,
  logo_url              TEXT,
  website_url           TEXT,
  -- Tax
  vat_number            TEXT,
  vat_rate              NUMERIC(5,4)  NOT NULL DEFAULT 0.15
                          CHECK (vat_rate >= 0 AND vat_rate <= 1),
  -- Bank details (rendered on EFT payment page and PDF invoices)
  bank_name             TEXT,
  bank_account_holder   TEXT,
  bank_account_number   TEXT,
  bank_branch_code      TEXT,
  bank_account_type     TEXT,
  bank_reference_prefix TEXT          NOT NULL DEFAULT 'INV',
  -- Email
  email_from_name       TEXT,
  email_from_address    TEXT,
  email_reply_to        TEXT,
  -- Support contact
  support_phone         TEXT,
  support_email         TEXT,
  -- Terms
  payment_terms_days    INT           NOT NULL DEFAULT 30
                          CHECK (payment_terms_days >= 0),
  -- Misc
  footer_text           TEXT,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_config_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.tenant_config IS
  'Singleton config row. Contains supplier branding, bank details, VAT rate, and email settings.';

-- Pre-insert the singleton so it always exists
INSERT INTO public.tenant_config (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ============================================================
-- TABLE: global_settings
-- ============================================================
-- Singleton row (id must always be 1).
-- Stores portal-wide notification banner state.

CREATE TABLE public.global_settings (
  id               INT         PRIMARY KEY DEFAULT 1,
  banner_message   TEXT,
  is_banner_active BOOLEAN     NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT global_settings_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.global_settings IS
  'Singleton config row (id always = 1). Stores portal-wide notification banner state.';

INSERT INTO public.global_settings (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ============================================================
-- TABLE: profiles
-- ============================================================
-- Unified user table: admins (Supabase Auth) + buyers (custom JWT).
--
-- Admin rows:  id === auth.users.id,  auth_user_id IS NOT NULL, account_number IS NULL
-- Buyer rows:  id is a fresh UUID,    auth_user_id IS NULL,     account_number IS NOT NULL

CREATE TABLE public.profiles (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Links to Supabase Auth for admins only; NULL for all buyer rows
  auth_user_id        UUID            UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Buyer login credential, e.g. "RAS-00123". NULL for admins.
  account_number      TEXT            UNIQUE,
  role                public.app_role NOT NULL DEFAULT 'buyer_default',
  -- Business details
  business_name       TEXT            NOT NULL,
  trading_name        TEXT,
  vat_number          TEXT,
  -- Primary contact
  contact_name        TEXT            NOT NULL,
  contact_title       TEXT,
  email               TEXT,
  phone               TEXT,
  mobile              TEXT,
  fax                 TEXT,
  -- Commercial settings
  credit_limit        NUMERIC(12,2)   CHECK (credit_limit IS NULL OR credit_limit >= 0),
  available_credit    NUMERIC(12,2)   CHECK (available_credit IS NULL OR available_credit >= 0),
  payment_terms_days  INT,            -- overrides tenant_config.payment_terms_days when set
  -- Admin-only internal notes (not visible to buyer)
  notes               TEXT,
  is_active           BOOLEAN         NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_requires_auth_user
    CHECK (role != 'admin' OR auth_user_id IS NOT NULL),
  CONSTRAINT buyer_requires_account_number
    CHECK (role = 'admin' OR account_number IS NOT NULL),
  CONSTRAINT account_number_format
    CHECK (account_number IS NULL OR account_number ~ '^[A-Z0-9][A-Z0-9\-]{1,18}[A-Z0-9]$')
);

COMMENT ON TABLE public.profiles IS
  'Unified user table. Admins link to auth.users; buyers authenticate via custom JWT.';
COMMENT ON COLUMN public.profiles.auth_user_id IS
  'FK to auth.users. Populated for admins only. NULL for all buyers.';
COMMENT ON COLUMN public.profiles.account_number IS
  'Buyer login credential (e.g. RAS-00123). NULL for admins.';
COMMENT ON COLUMN public.profiles.credit_limit IS
  'Maximum outstanding balance allowed for this buyer. NULL = no limit enforced.';
COMMENT ON COLUMN public.profiles.payment_terms_days IS
  'Per-buyer override. When set, supersedes tenant_config.payment_terms_days.';


-- ============================================================
-- TABLE: addresses
-- ============================================================
-- Normalized buyer address book.
-- Multiple billing and shipping addresses per profile.
-- Exactly one default per (profile_id, type) pair enforced by partial unique index.

CREATE TABLE public.addresses (
  id              UUID                NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID                NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            public.address_type NOT NULL DEFAULT 'shipping',
  label           TEXT,                   -- e.g. "Head Office", "Cape Town Warehouse"
  line1           TEXT                NOT NULL,
  line2           TEXT,
  suburb          TEXT,
  city            TEXT                NOT NULL,
  province        TEXT,
  postal_code     TEXT,
  country         TEXT                NOT NULL DEFAULT 'South Africa',
  is_default      BOOLEAN             NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.addresses IS
  'Buyer address book. Snapshotted as JSONB onto orders at checkout time.';

-- Enforce at most one default per profile per address type
CREATE UNIQUE INDEX idx_addresses_one_default_per_type
  ON public.addresses (profile_id, type)
  WHERE is_default = true;


-- ============================================================
-- TABLE: categories
-- ============================================================
-- Replaces the free-text `category TEXT` column that was on products.
-- Products reference categories via FK.

CREATE TABLE public.categories (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL UNIQUE,
  slug            TEXT          NOT NULL UNIQUE,
  description     TEXT,
  display_order   INT           NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

COMMENT ON TABLE public.categories IS
  'Normalized product categories. Products reference category via category_id FK.';
COMMENT ON COLUMN public.categories.slug IS
  'URL-safe lowercase identifier, e.g. "cleaning-supplies". Auto-generate from name in application.';


-- ============================================================
-- TABLE: products
-- ============================================================
-- Normalized: category is now a FK to categories.
-- Images are in product_images (supports multiple).
-- Stock tracking is optional per product.

CREATE TABLE public.products (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku             TEXT          NOT NULL UNIQUE,
  name            TEXT          NOT NULL,
  description     TEXT,
  details         TEXT,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  -- Normalized category (replaces free-text category column)
  category_id     UUID          REFERENCES public.categories(id) ON DELETE SET NULL,
  -- Optional inventory tracking
  track_stock     BOOLEAN       NOT NULL DEFAULT false,
  stock_qty       INT           NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  low_stock_alert INT           CHECK (low_stock_alert IS NULL OR low_stock_alert >= 0),
  -- Flexible variant groups: [{"label": "Size", "options": ["500ml", "1L", "5L"]}]
  variants        JSONB         NOT NULL DEFAULT '[]'::jsonb,
  -- Full-text search tags
  tags            TEXT[]        NOT NULL DEFAULT '{}',
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  -- Bulk discount engine
  discount_type       TEXT            CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  discount_threshold  INT             CHECK (discount_threshold IS NULL OR discount_threshold > 0),
  discount_value      NUMERIC(10,2)   CHECK (discount_value IS NULL OR discount_value >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.products.variants IS
  'Variant groups. Example: [{"label":"Size","options":["500ml","1L"]}]';
COMMENT ON COLUMN public.products.price IS
  'Base price in ZAR. Displayed to buyers.';
COMMENT ON COLUMN public.products.track_stock IS
  'When true: purchases blocked when stock_qty = 0; stock decremented on order confirmation.';
COMMENT ON COLUMN public.products.tags IS
  'Search and filter tags, e.g. ARRAY[''cleaning'',''industrial'',''bulk''].';


-- ============================================================
-- TABLE: product_images
-- ============================================================
-- Replaces the single image_url column on products.
-- Supports multiple images per product with ordering.
-- Exactly one primary image per product enforced by partial unique index.

CREATE TABLE public.product_images (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url             TEXT          NOT NULL,
  alt_text        TEXT,
  display_order   INT           NOT NULL DEFAULT 0,
  is_primary      BOOLEAN       NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_images IS
  'Multiple images per product. Use is_primary=true for the catalog thumbnail.';

-- Enforce at most one primary image per product
CREATE UNIQUE INDEX idx_product_images_one_primary
  ON public.product_images (product_id)
  WHERE is_primary = true;


-- ============================================================
-- TABLE: orders
-- ============================================================

CREATE TABLE public.orders (
  id                      UUID                  NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Human-readable reference number, e.g. ORD-000042
  reference_number        TEXT                  NOT NULL UNIQUE DEFAULT public.generate_order_reference(),
  profile_id              UUID                  NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status                  public.order_status   NOT NULL DEFAULT 'pending',
  payment_method          public.payment_method NOT NULL,
  -- Financials (all in ZAR)
  subtotal                NUMERIC(10,2)         NOT NULL CHECK (subtotal >= 0),
  discount_amount         NUMERIC(10,2)         NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  vat_amount              NUMERIC(10,2)         NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount            NUMERIC(10,2)         NOT NULL CHECK (total_amount >= 0),
  -- Shipping address snapshotted at checkout (survives address book changes)
  shipping_address        JSONB,
  -- Buyer-supplied references
  buyer_reference         TEXT,               -- buyer's own PO number
  delivery_instructions   TEXT,
  notes                   TEXT,
  order_notes             TEXT,               -- buyer-supplied notes at checkout
  -- Status timestamps
  confirmed_at            TIMESTAMPTZ,
  fulfilled_at            TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.orders.reference_number IS
  'Human-readable order reference (ORD-000001). Auto-generated. Used on invoices and emails.';
COMMENT ON COLUMN public.orders.subtotal IS
  'Sum of all order_items.line_total before order-level discount and VAT.';
COMMENT ON COLUMN public.orders.vat_amount IS
  'VAT computed from subtotal and tenant_config.vat_rate at time of order placement.';
COMMENT ON COLUMN public.orders.shipping_address IS
  'Snapshot of the delivery address at checkout. Independent of addresses table.';
COMMENT ON COLUMN public.orders.buyer_reference IS
  'Buyer''s own purchase order number or internal reference code.';


-- ============================================================
-- TABLE: order_items
-- ============================================================
-- Product fields are snapshotted at order time to preserve
-- accuracy even if the product is later edited or deleted.

CREATE TABLE public.order_items (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Nullable: product may be deleted later, but snapshot fields below are preserved
  product_id      UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  -- Snapshotted at order time
  sku             TEXT          NOT NULL,
  product_name    TEXT          NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity        INTEGER       NOT NULL CHECK (quantity > 0),
  -- Line-item discount percentage (0-100)
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  -- line_total = ROUND(unit_price * quantity * (1 - discount_pct / 100), 2)
  line_total      NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
  -- Selected variant at order time, e.g. {"label": "Size", "value": "1L"}
  variant_info    JSONB         DEFAULT NULL
);

COMMENT ON TABLE public.order_items IS
  'Snapshotted line items. Accurate even after product edits or deletion.';
COMMENT ON COLUMN public.order_items.discount_pct IS
  'Per-line discount (%). Applied before line_total: unit_price * qty * (1 - pct/100).';


-- ============================================================
-- TABLE: payments
-- ============================================================
-- Tracks EFT payment submissions against orders.
-- 30-day account orders skip this table entirely.
-- One order can have multiple payment submissions
-- (e.g. rejected, then resubmitted).

CREATE TABLE public.payments (
  id                UUID                    NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID                    NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_method    public.payment_method   NOT NULL DEFAULT 'eft',
  amount            NUMERIC(10,2)           NOT NULL CHECK (amount > 0),
  status            public.payment_status   NOT NULL DEFAULT 'pending',
  -- Supabase Storage URL of uploaded proof of payment image
  proof_url         TEXT,
  -- Bank reference used by buyer when making the transfer
  reference         TEXT,
  rejection_reason  TEXT,
  notes             TEXT,
  submitted_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  verified_at       TIMESTAMPTZ,
  -- Admin who verified or rejected
  verified_by       UUID                    REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.payments IS
  'EFT payment submissions. Multiple allowed per order (e.g. rejected then resubmitted).';
COMMENT ON COLUMN public.payments.proof_url IS
  'Supabase Storage URL for uploaded proof-of-payment document.';


-- ============================================================
-- TABLE: order_status_history
-- ============================================================
-- Immutable, append-only audit trail of order status transitions.
-- Rows are inserted automatically by trigger; never updated or deleted.

CREATE TABLE public.order_status_history (
  id              UUID                  NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID                  NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status     public.order_status,          -- NULL on initial insert
  to_status       public.order_status   NOT NULL,
  changed_by      UUID                  REFERENCES public.profiles(id) ON DELETE SET NULL,
  note            TEXT,
  changed_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.order_status_history IS
  'Immutable audit trail of order status changes. Populated by trigger only.';


-- ============================================================
-- TABLE: buyer_sessions
-- ============================================================
-- Server-side registry of issued buyer JWTs.
-- id is used as the jti (JWT ID) claim.
-- Token is considered invalid when revoked_at IS NOT NULL.
-- Server-side creation via service role client only.

CREATE TABLE public.buyer_sessions (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ   NOT NULL,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoke_reason   TEXT,
  -- Client fingerprinting (informational only)
  user_agent      TEXT,
  ip_address      INET
);

COMMENT ON TABLE public.buyer_sessions IS
  'Server-side registry for buyer JWTs. Supports revocation by setting revoked_at.';
COMMENT ON COLUMN public.buyer_sessions.id IS
  'Used as the jti claim in buyer JWTs. Validate against this table on each request.';


-- ============================================================
-- TABLE: audit_log
-- ============================================================
-- Append-only record of INSERT/UPDATE/DELETE on critical tables.
-- Populated by SECURITY DEFINER trigger functions (bypasses RLS).
-- actor_id = auth.uid() at time of action (NULL for unauthenticated triggers).

CREATE TABLE public.audit_log (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID,
  action          TEXT          NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  schema_name     TEXT          NOT NULL DEFAULT 'public',
  table_name      TEXT          NOT NULL,
  record_id       UUID,
  old_data        JSONB,
  new_data        JSONB,
  changed_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit log. Populated by triggers on profiles, products, orders.';


-- ============================================================
-- INDEXES
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_account_number  ON public.profiles(account_number)   WHERE account_number IS NOT NULL;
CREATE INDEX idx_profiles_auth_user_id    ON public.profiles(auth_user_id)      WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_profiles_role            ON public.profiles(role);
CREATE INDEX idx_profiles_is_active       ON public.profiles(is_active);

-- addresses
CREATE INDEX idx_addresses_profile_id     ON public.addresses(profile_id);
CREATE INDEX idx_addresses_type           ON public.addresses(type);

-- categories
CREATE INDEX idx_categories_slug          ON public.categories(slug);
CREATE INDEX idx_categories_is_active     ON public.categories(is_active);
CREATE INDEX idx_categories_display_order ON public.categories(display_order);

-- products
CREATE INDEX idx_products_sku             ON public.products(sku);
CREATE INDEX idx_products_category_id     ON public.products(category_id);
CREATE INDEX idx_products_is_active       ON public.products(is_active);
CREATE INDEX idx_products_tags            ON public.products USING GIN(tags);

-- product_images
CREATE INDEX idx_product_images_product   ON public.product_images(product_id);
CREATE INDEX idx_product_images_order     ON public.product_images(product_id, display_order);

-- orders
CREATE INDEX idx_orders_profile_id        ON public.orders(profile_id);
CREATE INDEX idx_orders_status            ON public.orders(status);
CREATE INDEX idx_orders_created_at        ON public.orders(created_at DESC);
CREATE INDEX idx_orders_reference_number  ON public.orders(reference_number);

-- order_items
CREATE INDEX idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id   ON public.order_items(product_id);

-- payments
CREATE INDEX idx_payments_order_id        ON public.payments(order_id);
CREATE INDEX idx_payments_status          ON public.payments(status);

-- order_status_history
CREATE INDEX idx_order_status_order_id    ON public.order_status_history(order_id);
CREATE INDEX idx_order_status_changed_at  ON public.order_status_history(changed_at DESC);

-- buyer_sessions
CREATE INDEX idx_buyer_sessions_profile   ON public.buyer_sessions(profile_id);
CREATE INDEX idx_buyer_sessions_expires   ON public.buyer_sessions(expires_at);

-- audit_log
CREATE INDEX idx_audit_log_table_record   ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_actor          ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_changed_at     ON public.audit_log(changed_at DESC);


-- ============================================================
-- TRIGGER FUNCTION: updated_at auto-maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenant_config_updated_at
  BEFORE UPDATE ON public.tenant_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- TRIGGER FUNCTION: line_total integrity validation
-- ============================================================
-- Enforces: line_total = ROUND(unit_price * quantity * (1 - discount_pct / 100), 2)
-- Guards against application bugs or direct DB writes.

CREATE OR REPLACE FUNCTION public.validate_line_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected NUMERIC(10,2);
BEGIN
  expected := ROUND(NEW.unit_price * NEW.quantity * (1.0 - NEW.discount_pct / 100.0), 2);
  IF NEW.line_total <> expected THEN
    RAISE EXCEPTION
      'line_total integrity violation: expected % (% x % x (1 - %/100)), got %',
      expected, NEW.unit_price, NEW.quantity, NEW.discount_pct, NEW.line_total;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_items_validate_line_total
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_line_total();


-- ============================================================
-- TRIGGER FUNCTION: auto-record order status transitions
-- ============================================================
-- Appends a row to order_status_history on every status change.
-- SECURITY DEFINER so the trigger can write to order_status_history
-- regardless of the calling user's RLS context.

CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_status_history
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status_change();


-- ============================================================
-- TRIGGER FUNCTION: auto-create admin profile on Auth sign-up
-- ============================================================
-- When a Supabase Auth user is created with metadata { "role": "admin" },
-- this trigger inserts a profile row where profile.id === auth.users.id.
-- This is required for admin RLS to resolve correctly via auth.uid().

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'role' = 'admin' THEN
    INSERT INTO public.profiles (
      id,
      auth_user_id,
      role,
      business_name,
      contact_name,
      email
    ) VALUES (
      NEW.id,
      NEW.id,
      'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'Admin'),
      COALESCE(NEW.raw_user_meta_data ->> 'contact_name', 'Administrator'),
      NEW.email
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();


-- ============================================================
-- TRIGGER FUNCTION: audit logging
-- ============================================================
-- SECURITY DEFINER so writes to audit_log bypass RLS
-- regardless of who triggered the action.

CREATE OR REPLACE FUNCTION public.log_table_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (row_to_json(OLD) ->> 'id')::UUID
      ELSE                       (row_to_json(NEW) ->> 'id')::UUID
    END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();


-- ============================================================
-- ROW LEVEL SECURITY -- enable on all tables
-- ============================================================

ALTER TABLE public.tenant_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- RLS: tenant_config
-- ------------------------------------------------------------

CREATE POLICY "all_read_tenant_config"
  ON public.tenant_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins_update_tenant_config"
  ON public.tenant_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------
-- RLS: global_settings
-- ------------------------------------------------------------

CREATE POLICY "admins_manage_global_settings"
  ON public.global_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "authenticated_read_global_settings"
  ON public.global_settings
  FOR SELECT
  TO authenticated
  USING (true);


-- ------------------------------------------------------------
-- RLS: profiles
-- ------------------------------------------------------------

CREATE POLICY "admins_select_all_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "buyers_select_own_profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() AND NOT public.is_admin());

CREATE POLICY "admins_insert_profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins_update_profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins_delete_profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());


-- ------------------------------------------------------------
-- RLS: addresses
-- ------------------------------------------------------------

CREATE POLICY "admins_all_addresses"
  ON public.addresses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "buyers_select_own_addresses"
  ON public.addresses FOR SELECT TO authenticated
  USING (profile_id = auth.uid() AND NOT public.is_admin());

CREATE POLICY "buyers_insert_own_addresses"
  ON public.addresses FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND NOT public.is_admin());

CREATE POLICY "buyers_update_own_addresses"
  ON public.addresses FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND NOT public.is_admin())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "buyers_delete_own_addresses"
  ON public.addresses FOR DELETE TO authenticated
  USING (profile_id = auth.uid() AND NOT public.is_admin());


-- ------------------------------------------------------------
-- RLS: categories
-- ------------------------------------------------------------

CREATE POLICY "all_read_active_categories"
  ON public.categories FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "admins_insert_categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins_update_categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins_delete_categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.is_admin());


-- ------------------------------------------------------------
-- RLS: products
-- ------------------------------------------------------------

CREATE POLICY "select_products"
  ON public.products FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "admins_insert_products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins_update_products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins_delete_products"
  ON public.products FOR DELETE TO authenticated
  USING (public.is_admin());


-- ------------------------------------------------------------
-- RLS: product_images
-- ------------------------------------------------------------

CREATE POLICY "all_read_product_images"
  ON public.product_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND (p.is_active = true OR public.is_admin())
    )
  );

CREATE POLICY "admins_manage_product_images"
  ON public.product_images FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------
-- RLS: orders
-- ------------------------------------------------------------

CREATE POLICY "select_orders"
  ON public.orders FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY "buyers_insert_own_orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND NOT public.is_admin());

CREATE POLICY "admins_update_orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins_delete_orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.is_admin());


-- ------------------------------------------------------------
-- RLS: order_items
-- ------------------------------------------------------------

CREATE POLICY "select_order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.profile_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "buyers_insert_order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_update_order_items"
  ON public.order_items FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------
-- RLS: payments
-- ------------------------------------------------------------

CREATE POLICY "select_payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND (o.profile_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "buyers_insert_own_payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_update_payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------
-- RLS: order_status_history
-- ------------------------------------------------------------
-- Rows inserted by SECURITY DEFINER trigger only; no direct INSERT policy.

CREATE POLICY "select_order_status_history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND (o.profile_id = auth.uid() OR public.is_admin())
    )
  );


-- ------------------------------------------------------------
-- RLS: buyer_sessions
-- ------------------------------------------------------------
-- Created server-side via service role; no INSERT policy for authenticated.

CREATE POLICY "buyers_select_own_sessions"
  ON public.buyer_sessions FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY "admins_revoke_sessions"
  ON public.buyer_sessions FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------
-- RLS: audit_log
-- ------------------------------------------------------------
-- Written by SECURITY DEFINER triggers only; admins can read.

CREATE POLICY "admins_select_audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());


-- ============================================================
-- END OF SCRIPT
-- ============================================================
-- After running:
--   1. Verify all 13 tables appear in the Table Editor.
--   2. Create your first admin via Supabase Auth dashboard with metadata:
--      { "role": "admin", "business_name": "Your Business", "contact_name": "Your Name" }
--   3. The trg_on_auth_user_created trigger will auto-create the profile row.
--   4. Update the tenant_config row (id=1) with your real bank details and branding.
-- ============================================================
