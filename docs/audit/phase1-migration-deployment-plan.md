# Phase 1 Security Hardening — Production Deployment Plan

**Date produced:** 2026-05-04  
**Branch:** `docs/phase1-migration-plan`  
**Status:** AWAITING DEVELOPER REVIEW — do not execute until approved  
**Produced by:** Read-only live schema inspection via Supabase MCP  

---

## EXECUTIVE SUMMARY

Of the 11 Phase 1 migrations, the live schema inspection reveals substantial schema drift: many fixes were applied manually to production at some point prior to the formal 20260430 migration run. The deployment picture is therefore:

| # | File | Action | Reason |
|---|------|--------|--------|
| 01 | `20260414_01_C1_…` | **APPLY** (no-ops) | Effects present; all ALTERs are idempotent |
| 02 | `20260414_02_H1_…` | **APPLY** (no-ops) | Effects present; all REVOKEs are idempotent |
| 03 | `20260414_03_H2_…` | **APPLY** (no-ops) | Effects present; all REVOKEs are idempotent |
| 04 | `20260414_04_H7_…` | **SKIP** ⚠️ | `CREATE POLICY` will error — policy already exists |
| 05 | `20260414_05_H8_…` | **APPLY** (no-ops) | Effects present; REVOKEs and column GRANTs idempotent |
| 06 | `20260414_06_L9_…` | **APPLY** (no-ops) | Effects present; all ALTERs are idempotent |
| 07 | `20260414_07_L10_…` | **SKIP** 🚨 | Would DOWNGRADE production function — breaks checkout |
| 08 | `20260414_08_L11_…` | **SKIP** ⚠️ | `CREATE TRIGGER` will error — all 5 triggers already exist |
| 09 | `20260414_09_M8_…` | **APPLY** (safe) | DROP IF EXISTS + CREATE is atomic; bucket UPDATE is no-op |
| 10 | `20260414_10_M9_…` | **APPLY** (safe) | INSERT ON CONFLICT is no-op; DROP IF EXISTS + CREATE is safe |
| 11 | `20260414_11_M6_…` | **APPLY** (no-ops) | Column and index both already exist; IF NOT EXISTS guards |

**Migrations requiring execution: 8** (01, 02, 03, 05, 06, 09, 10, 11)  
**Migrations to skip: 3** (04, 07, 08)  
**Highest-risk migration: 07** — would break checkout if applied  

---

## SECTION 1 — PRE-FLIGHT CONTEXT

### 1.1 Production Migration State

Verified via `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260414%'`:

```
(0 rows)
```

None of the 11 Phase 1 migrations have been recorded in `schema_migrations`. However, live schema inspection shows that most of their effects are already present in production (see per-migration analysis). The most likely explanation: these changes were applied manually via SQL Editor before the 20260430 feature migrations were run through the CLI.

The three 20260430 migrations that ARE in `schema_migrations`:

| Version | Name |
|---------|------|
| `20260430145500` | `account_number_sequence` |
| `20260430145951` | `client_custom_pricing` |
| `20260430150809` | `order_shipping_address` ← critical: evolved `create_order_atomic` |

Migration `20260430150809` is the reason migration 07 must be skipped — it supersedes 07 with a newer version of `create_order_atomic` that adds `shipping_address` support.

### 1.2 Production VAT Rate

Verified via `SELECT vat_rate FROM public.tenant_config LIMIT 1`:

```
vat_rate: 0.1500
```

No Phase 1 migration modifies `vat_rate`. Confirmed no risk here.

### 1.3 RLS State

Verified via `pg_class` for all 14 public tables:

| Table | RLS Enabled | FORCE RLS |
|-------|-------------|-----------|
| addresses | ✓ | ✗ |
| audit_log | ✓ | ✗ |
| buyer_sessions | ✓ | ✗ |
| categories | ✓ | ✗ |
| client_custom_prices | ✓ | ✗ |
| global_settings | ✓ | ✗ |
| order_items | ✓ | ✗ |
| order_status_history | ✓ | ✗ |
| orders | ✓ | ✗ |
| payments | ✓ | ✗ |
| product_images | ✓ | ✗ |
| products | ✓ | ✗ |
| profiles | ✓ | ✗ |
| tenant_config | ✓ | ✗ |

RLS is enabled on all tables. `FORCE ROW LEVEL SECURITY` is not set on any table — this means the `postgres` (superuser) role and service_role can bypass RLS. This is the current production behaviour and none of the Phase 1 migrations change it. The Phase 2 hardening plan addresses FORCE RLS.

### 1.4 SECURITY DEFINER Functions — Current State

Verified via `pg_proc`:

| Function | SECURITY DEFINER | search_path (current) | search_path (target) | Delta |
|---|---|---|---|---|
| `create_order_atomic(jsonb,jsonb)` | ✓ | `public, pg_temp` | `public, pg_temp` | None |
| `custom_access_token_hook(jsonb)` | ✓ | `public` | _(not targeted)_ | N/A |
| `generate_order_reference()` | ✗ | `public, pg_temp` | `public, pg_temp` | None |
| `get_app_role()` | ✓ | `public, pg_temp` | `public, pg_temp` | None |
| `handle_new_admin_user()` | ✓ | `public` | _(not targeted)_ | N/A |
| `handle_new_buyer_user()` | ✓ | `public` | _(not targeted)_ | N/A |
| `handle_updated_at()` | ✗ | `public, pg_temp` | `public, pg_temp` | None |
| `is_admin()` | ✓ | `public, pg_temp` | `public, pg_temp` | None |
| `log_table_audit()` | ✓ | `public` | _(not targeted)_ | N/A |
| `record_order_status_change()` | ✓ | `public, pg_temp` | `public, pg_temp` | None |
| `rls_auto_enable()` | ✓ | `pg_catalog` | _(not targeted)_ | N/A |
| `set_updated_at()` | ✗ | _(none)_ | _(not targeted)_ | N/A |
| `validate_line_total()` | ✗ | `public, pg_temp` | `public, pg_temp` | None |

All functions targeted by migrations 01 and 06 already have the correct `search_path`. The ALTER FUNCTION statements will be no-ops.

**Note:** `custom_access_token_hook`, `handle_new_admin_user`, `handle_new_buyer_user`, and `log_table_audit` are not targeted by Phase 1 but have `search_path=public` (no `pg_temp`). These are candidates for the Phase 2 hardening round.

### 1.5 Tables Added or Modified Since 14 April 2026

The following tables/columns were added by the 20260430 migrations and were not present when the Phase 1 migrations were authored:

| Object | Added by | Relevance to Phase 1 |
|--------|----------|----------------------|
| `public.client_custom_prices` | `20260430145951` | Not referenced by any Phase 1 migration |
| `profiles.client_discount_pct` | `20260430145951` | Not referenced |
| `orders.shipping_address` | Existed before; populated by `20260430150809` | Referenced by evolved `create_order_atomic` — see migration 07 analysis |
| `orders.client_submission_id` | `20260414_11` (manual) | Column exists; not in migration 05's column GRANT list — see §1.6 |

### 1.6 Column Grant Gap — `orders.client_submission_id`

Migration 05 (`H8`) issues a column-level `GRANT SELECT` on orders to `authenticated`, explicitly listing each column. `client_submission_id` was added by migration 11 (the same batch, applied manually) but is **not** in the GRANT list in migration 05.

**Current state:** `authenticated` has no SELECT on `client_submission_id`. This is correct — it is an internal idempotency token that buyers do not need to read. The service_role admin client (used by all checkout code) bypasses column grants entirely.

**No action required.** Documented here to prevent confusion.

---

## SECTION 2 — PER-MIGRATION ANALYSIS

---

### Migration 01 — `20260414_01_C1_pin_is_admin_search_path.sql`

**File:** `supabase/migrations/20260414_01_C1_pin_is_admin_search_path.sql`

**Summary:** Pins `search_path = public, pg_temp` on `get_app_role()` and `is_admin()`, and revokes CREATE on schema public from `authenticated` and `anon`.

**SQL (verbatim, lines 12–16):**
```sql
ALTER FUNCTION public.get_app_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()     SET search_path = public, pg_temp;

REVOKE CREATE ON SCHEMA public FROM authenticated;
REVOKE CREATE ON SCHEMA public FROM anon;
```

**Dependencies:** Functions `get_app_role()` and `is_admin()` must exist. Both confirmed present.

**Current production state vs. target:**
- `get_app_role()` search_path: `public, pg_temp` ✓ (already correct)
- `is_admin()` search_path: `public, pg_temp` ✓ (already correct)
- `authenticated` has CREATE on public: `false` ✓ (already revoked)
- `anon` has CREATE on public: `false` ✓ (already revoked)

**Schema drift:** All effects already present. Entire migration is a no-op.

**Risk:** **LOW** — ALTERing a function's `search_path` config is instantaneous and non-disruptive. REVOKE on non-existent privilege is a no-op.

**Estimated execution time:** < 1 second

**Locking:** None — `ALTER FUNCTION` takes no table lock.

**Rollback:**
```sql
-- Restores original state (no search_path pinned)
ALTER FUNCTION public.get_app_role() RESET search_path;
ALTER FUNCTION public.is_admin()     RESET search_path;
GRANT CREATE ON SCHEMA public TO authenticated;
GRANT CREATE ON SCHEMA public TO anon;
```

**Smoke test:**
```sql
-- Must return 'public, pg_temp' for both
SELECT proname, proconfig
FROM pg_proc
WHERE proname IN ('get_app_role','is_admin')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

---

### Migration 02 — `20260414_02_H1_lock_down_order_items_writes.sql`

**File:** `supabase/migrations/20260414_02_H1_lock_down_order_items_writes.sql`

**Summary:** Drops `buyers_insert_order_items` policy and revokes INSERT/UPDATE/DELETE on `order_items` from authenticated and anon.

**SQL (verbatim, lines 13–16):**
```sql
DROP POLICY IF EXISTS "buyers_insert_order_items" ON public.order_items;

REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon;
```

**Dependencies:** Table `order_items` must exist. Confirmed present.

**Current production state vs. target:**
- Policy `buyers_insert_order_items`: does not exist ✓
- `authenticated` table grants on `order_items`: SELECT, REFERENCES, TRIGGER, TRUNCATE (no INSERT/UPDATE/DELETE) ✓
- `anon` table grants on `order_items`: SELECT, REFERENCES, TRIGGER, TRUNCATE (no INSERT/UPDATE/DELETE) ✓

**Schema drift:** All effects already present. Entire migration is a no-op.

**Risk:** **LOW** — DROP POLICY IF EXISTS and REVOKE on non-existent privilege are both no-ops.

**Estimated execution time:** < 1 second

**Locking:** None.

**Rollback:**
```sql
-- Only needed if this migration somehow breaks something (it won't)
GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
```

**Smoke test:**
```sql
-- Must return 0 rows (no INSERT/UPDATE/DELETE grant for authenticated/anon)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'order_items'
  AND grantee IN ('authenticated','anon')
  AND privilege_type IN ('INSERT','UPDATE','DELETE');
```

---

### Migration 03 — `20260414_03_H2_lock_down_payments_writes.sql`

**File:** `supabase/migrations/20260414_03_H2_lock_down_payments_writes.sql`

**Summary:** Drops `buyers_insert_own_payments` policy and revokes INSERT/UPDATE/DELETE on `payments` from authenticated and anon.

**SQL (verbatim, lines 14–17):**
```sql
DROP POLICY IF EXISTS "buyers_insert_own_payments" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon;
```

**Dependencies:** Table `payments` must exist. Confirmed present.

**Current production state vs. target:**
- Policy `buyers_insert_own_payments`: does not exist ✓
- `authenticated` grants on `payments`: SELECT, REFERENCES, TRIGGER, TRUNCATE (no INSERT/UPDATE/DELETE) ✓
- `anon` grants on `payments`: SELECT, REFERENCES, TRIGGER, TRUNCATE (no INSERT/UPDATE/DELETE) ✓

**Schema drift:** All effects already present. Entire migration is a no-op.

**Risk:** **LOW**

**Estimated execution time:** < 1 second

**Locking:** None.

**Rollback:**
```sql
GRANT INSERT, UPDATE, DELETE ON public.payments TO authenticated;
```

**Smoke test:**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'payments'
  AND grantee IN ('authenticated','anon')
  AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- Must return 0 rows
```

---

### Migration 04 — `20260414_04_H7_lock_down_tenant_config.sql` ⚠️ SKIP

**File:** `supabase/migrations/20260414_04_H7_lock_down_tenant_config.sql`

**Summary:** Drops `all_read_tenant_config` policy, creates `admins_read_tenant_config` policy, and revokes SELECT on `tenant_config` from authenticated and anon.

**SQL (verbatim, lines 17–27):**
```sql
DROP POLICY IF EXISTS "all_read_tenant_config" ON public.tenant_config;

CREATE POLICY "admins_read_tenant_config"
  ON public.tenant_config FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE SELECT ON public.tenant_config FROM authenticated;
REVOKE SELECT ON public.tenant_config FROM anon;
```

**Current production state vs. target:**
- Policy `all_read_tenant_config`: does not exist ✓
- Policy `admins_read_tenant_config`: **ALREADY EXISTS** ← execution blocker
- `authenticated` SELECT on `tenant_config`: not present ✓ (already revoked)
- `anon` SELECT on `tenant_config`: not present ✓ (already revoked)

**WILL FAIL:** `CREATE POLICY "admins_read_tenant_config"` will error:
```
ERROR:  42710: policy "admins_read_tenant_config" for table "tenant_config" already exists
```
PostgreSQL does not support `CREATE POLICY IF NOT EXISTS` or `CREATE OR REPLACE POLICY` (prior to PG15 with restricted support). All three desired effects are already present in production.

**ACTION: SKIP THIS MIGRATION ENTIRELY.** All security goals are achieved. Do not run it.

**Risk of skipping:** **NONE** — desired state is already present.  
**Risk of running as-is:** **MEDIUM** — would error and abort execution; no damage, but wastes deployment window time and causes confusion.

**Verification query (confirm skip is safe):**
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenant_config'
ORDER BY policyname;
-- Expected: admins_read_tenant_config (SELECT, is_admin()) and admins_update_tenant_config
-- NOT expected: all_read_tenant_config
```

---

### Migration 05 — `20260414_05_H8_lock_down_orders_columns.sql`

**File:** `supabase/migrations/20260414_05_H8_lock_down_orders_columns.sql`

**Summary:** Revokes blanket SELECT on `orders` from authenticated and anon, then re-grants SELECT on specific columns (excluding `notes` and `assigned_to`).

**SQL (verbatim, lines 17–40):**
```sql
REVOKE SELECT ON public.orders FROM authenticated;
REVOKE SELECT ON public.orders FROM anon;

GRANT SELECT (
  id,
  reference_number,
  profile_id,
  status,
  payment_method,
  payment_status,
  subtotal,
  discount_amount,
  vat_amount,
  total_amount,
  shipping_address,
  buyer_reference,
  delivery_instructions,
  order_notes,
  confirmed_at,
  fulfilled_at,
  cancelled_at,
  created_at,
  updated_at
) ON public.orders TO authenticated;
```

**Current production state vs. target:**
- `authenticated` table-level SELECT on `orders`: not present ✓ (already revoked)
- `anon` table-level SELECT on `orders`: not present ✓ (already revoked)
- `authenticated` column SELECT grants on `orders`: buyer_reference, cancelled_at, confirmed_at, created_at, delivery_instructions, discount_amount, fulfilled_at, id, order_notes, payment_method, payment_status, profile_id, reference_number, shipping_address, status, subtotal, total_amount, updated_at, vat_amount ✓
- `notes` and `assigned_to` are **excluded** from SELECT ✓

**Schema drift:** All effects already present. Migration is a no-op.

**Risk:** **LOW** — REVOKE on non-existent privilege and re-GRANT of existing grant are both no-ops.

**Estimated execution time:** < 1 second

**Locking:** None.

**Rollback:**
```sql
-- Restore full table-level SELECT
GRANT SELECT ON public.orders TO authenticated;
```

**Smoke test:**
```sql
-- Must NOT include 'notes' or 'assigned_to'
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'orders'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT'
ORDER BY column_name;
```

---

### Migration 06 — `20260414_06_L9_pin_remaining_function_search_paths.sql`

**File:** `supabase/migrations/20260414_06_L9_pin_remaining_function_search_paths.sql`

**Summary:** Pins `search_path = public, pg_temp` on four trigger/helper functions.

**SQL (verbatim, lines 10–13):**
```sql
ALTER FUNCTION public.generate_order_reference()   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()          SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_line_total()        SET search_path = public, pg_temp;
ALTER FUNCTION public.record_order_status_change() SET search_path = public, pg_temp;
```

**Current production state vs. target:**
- `generate_order_reference()`: `search_path=public, pg_temp` ✓
- `handle_updated_at()`: `search_path=public, pg_temp` ✓
- `validate_line_total()`: `search_path=public, pg_temp` ✓
- `record_order_status_change()`: `search_path=public, pg_temp` ✓

**Schema drift:** All effects already present. Entire migration is a no-op.

**Risk:** **LOW**

**Estimated execution time:** < 1 second

**Locking:** None.

**Rollback:**
```sql
ALTER FUNCTION public.generate_order_reference()   RESET search_path;
ALTER FUNCTION public.handle_updated_at()          RESET search_path;
ALTER FUNCTION public.validate_line_total()        RESET search_path;
ALTER FUNCTION public.record_order_status_change() RESET search_path;
```

**Smoke test:**
```sql
SELECT proname, proconfig
FROM pg_proc
WHERE proname IN ('generate_order_reference','handle_updated_at',
                  'validate_line_total','record_order_status_change')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- All four must show search_path=public, pg_temp in proconfig
```

---

### Migration 07 — `20260414_07_L10_create_order_atomic_role_guard.sql` 🚨 SKIP — WOULD BREAK CHECKOUT

**File:** `supabase/migrations/20260414_07_L10_create_order_atomic_role_guard.sql`

**Summary:** Replaces `create_order_atomic` with a version that adds the L10 caller-role guard (`auth.role() = 'service_role'` assertion).

**THIS MIGRATION MUST NOT BE APPLIED.**

**Why:** Migration `20260430150809` (which IS in `schema_migrations`) already superseded this migration by installing a newer version of `create_order_atomic` that:
1. Contains the L10 role guard (the security fix from this migration)
2. Additionally inserts `shipping_address` — which this migration (07) does **not** do

Running migration 07's `CREATE OR REPLACE FUNCTION` would **overwrite** the current production function with the older 8-column version. Orders placed after this migration would have `shipping_address = NULL` on the database row, regardless of what the buyer selected at checkout.

**Comparison of the two versions:**

| Feature | Migration 07 (do NOT apply) | Current production (20260430150809) |
|---|---|---|
| L10 role guard | ✓ | ✓ |
| `search_path=public, pg_temp` | ✓ | ✓ |
| Inserts `shipping_address` | **✗ — missing** | ✓ |
| service_role-only EXECUTE | ✓ | ✓ |

**Current production function body (verbatim — for reference):**
The production function currently inserts into `orders` with 9 columns:
```sql
INSERT INTO public.orders (
  profile_id, status, payment_method,
  subtotal, discount_amount, vat_amount, total_amount,
  order_notes, shipping_address          -- ← this line absent in migration 07
)
VALUES (
  ...
  CASE WHEN p_order->'shipping_address' IS NULL
            OR p_order->'shipping_address' = 'null'::jsonb
       THEN NULL
       ELSE p_order->'shipping_address'
  END
)
```

**ACTION: SKIP THIS MIGRATION ENTIRELY.** The L10 security goal is already present. Applying would cause data loss (shipping addresses silently dropped from new orders).

**Risk of skipping:** **NONE** — L10 guard, search_path, and grants are all already in the production function.  
**Risk of running:** **HIGH** — silent data loss on all orders placed after this migration.

**Verification query (confirm skip is safe):**
```sql
SELECT prosrc FROM pg_proc
WHERE proname = 'create_order_atomic'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Must contain 'service_role' (L10 guard) AND 'shipping_address' (post-07 evolution)
```

---

### Migration 08 — `20260414_08_L11_extend_audit_triggers.sql` ⚠️ SKIP

**File:** `supabase/migrations/20260414_08_L11_extend_audit_triggers.sql`

**Summary:** Creates five new audit triggers on `payments`, `order_items`, `tenant_config`, `addresses`, and `buyer_sessions`.

**SQL (verbatim, lines 12–30):**
```sql
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_tenant_config
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_config
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_addresses
  AFTER INSERT OR UPDATE OR DELETE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();

CREATE TRIGGER trg_audit_buyer_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.buyer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_table_audit();
```

**WILL FAIL:** All five triggers already exist in production. `CREATE TRIGGER` has no `IF NOT EXISTS` clause (PostgreSQL added `OR REPLACE` in PG14 but not `IF NOT EXISTS`). The first statement will error:
```
ERROR:  42710: trigger "trg_audit_payments" for relation "payments" already exists
```

**Current production triggers confirmed:**
- `trg_audit_payments` on payments (INSERT, UPDATE, DELETE) ✓
- `trg_audit_order_items` on order_items (INSERT, UPDATE, DELETE) ✓
- `trg_audit_tenant_config` on tenant_config (INSERT, UPDATE, DELETE) ✓
- `trg_audit_addresses` on addresses (INSERT, UPDATE, DELETE) ✓
- `trg_audit_buyer_sessions` on buyer_sessions (INSERT, UPDATE, DELETE) ✓

**ACTION: SKIP THIS MIGRATION ENTIRELY.** All five audit triggers are operational.

**Risk of skipping:** **NONE** — all desired audit coverage is already in place.  
**Risk of running:** **MEDIUM** — errors immediately; no damage, but halts deployment.

**Verification query (confirm skip is safe):**
```sql
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_audit_payments','trg_audit_order_items',
                       'trg_audit_tenant_config','trg_audit_addresses',
                       'trg_audit_buyer_sessions')
ORDER BY event_object_table, trigger_name;
-- Must return 15 rows (5 triggers × 3 events each)
```

---

### Migration 09 — `20260414_09_M8_lock_down_product_images_bucket.sql`

**File:** `supabase/migrations/20260414_09_M8_lock_down_product_images_bucket.sql`

**Summary:** Removes `image/svg+xml` from product-images bucket allowed MIME types and adds an explicit public-read storage policy.

**SQL (verbatim, lines 21–35):**
```sql
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'image/jpeg',
     'image/png',
     'image/webp',
     'image/gif'
   ]
 WHERE id = 'product-images';

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
```

**Current production state vs. target:**
- `product-images` allowed_mime_types: `['image/jpeg','image/png','image/webp','image/gif']` ✓ (SVG already removed)
- Policy `product_images_public_read`: **EXISTS** on storage.objects ✓ (matching definition)

**Schema drift:** Both effects already present. The `UPDATE` is a no-op (same values). The `DROP POLICY IF EXISTS` will drop the existing policy, and `CREATE POLICY` will recreate it identically. This is a brief atomic replacement — the DROP and CREATE execute in the same transaction, so there is no window where the policy is absent.

**Risk:** **LOW** — atomic DROP+CREATE in one transaction. Storage reads will not be disrupted.

**Estimated execution time:** < 1 second

**Locking:** None significant.

**Rollback:**
```sql
-- Restore SVG (not recommended — SVG upload enables stored XSS)
UPDATE storage.buckets
   SET allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
 WHERE id = 'product-images';
-- Policy rollback: DROP POLICY "product_images_public_read" ON storage.objects;
-- (This would make the bucket rely on public=true flag only, which still works)
```

**Smoke test:**
```sql
-- Confirm SVG absent from allowed types
SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'product-images';
-- Confirm policy exists
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'product_images_public_read';
```

---

### Migration 10 — `20260414_10_M9_create_payment_proofs_bucket.sql`

**File:** `supabase/migrations/20260414_10_M9_create_payment_proofs_bucket.sql`

**Summary:** Provisions the `payment-proofs` storage bucket with strict defaults (private, 5MB limit, PDF+raster only) and an admin-only read policy.

**SQL (verbatim, lines 18–36):**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_proofs_admin_read" ON storage.objects;
CREATE POLICY "payment_proofs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );
```

**Current production state vs. target:**
- `payment-proofs` bucket: EXISTS with `public=false`, `file_size_limit=5242880`, `allowed_mime_types=['image/jpeg','image/png','image/webp','application/pdf']` ✓
- Policy `payment_proofs_admin_read`: **EXISTS** on storage.objects ✓

**Schema drift:** Both effects already present. The `INSERT ON CONFLICT DO NOTHING` is a no-op. The `DROP POLICY IF EXISTS` + `CREATE POLICY` performs an atomic replacement of the identical policy.

**Risk:** **LOW**

**Estimated execution time:** < 1 second

**Locking:** None significant.

**Rollback:**
```sql
-- If the bucket needs removing (not recommended — it holds no objects currently):
-- DELETE FROM storage.buckets WHERE id = 'payment-proofs';
DROP POLICY IF EXISTS "payment_proofs_admin_read" ON storage.objects;
```

**Smoke test:**
```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'payment-proofs';
-- Must show: public=false, limit=5242880, 4 MIME types (no SVG, no office docs)

SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'payment_proofs_admin_read';
-- Must return 1 row
```

---

### Migration 11 — `20260414_11_M6_add_client_submission_id.sql`

**File:** `supabase/migrations/20260414_11_M6_add_client_submission_id.sql`

**Summary:** Adds a nullable `client_submission_id UUID` column to `orders` with a partial unique index to prevent duplicate order submissions.

**SQL (verbatim, lines 8–13):**
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_submission_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_submission_id
  ON public.orders (client_submission_id)
  WHERE client_submission_id IS NOT NULL;
```

**Current production state vs. target:**
- Column `orders.client_submission_id`: **EXISTS** (type: uuid, nullable) ✓
- Index `idx_orders_client_submission_id`: **EXISTS** — `CREATE UNIQUE INDEX idx_orders_client_submission_id ON public.orders USING btree (client_submission_id) WHERE (client_submission_id IS NOT NULL)` ✓

**Schema drift:** Both effects already present. Both statements use `IF NOT EXISTS` guards — complete no-ops.

**Risk:** **LOW**

**Estimated execution time:** < 1 second

**Locking:** The `ADD COLUMN IF NOT EXISTS` path when column already exists — no lock taken. `CREATE UNIQUE INDEX IF NOT EXISTS` when index already exists — no lock taken.

**Rollback:**
```sql
-- Only if column truly needs removing (would require app code changes first):
DROP INDEX IF EXISTS public.idx_orders_client_submission_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS client_submission_id;
```

**Smoke test:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name = 'client_submission_id';
-- Must return 1 row: uuid, YES

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'orders'
  AND indexname = 'idx_orders_client_submission_id';
-- Must return 1 row with partial index definition
```

---

## SECTION 3 — APPLICATION ORDER

Apply migrations in the following order. Migrations 04, 07, and 08 are explicitly **skipped**.

---

### Step 1 — Migration 01 (C1)

**Pre-flight check:**
```sql
-- Confirm both functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('get_app_role','is_admin')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: 2 rows
```

**Migration SQL:**
```sql
ALTER FUNCTION public.get_app_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()     SET search_path = public, pg_temp;

REVOKE CREATE ON SCHEMA public FROM authenticated;
REVOKE CREATE ON SCHEMA public FROM anon;
```

**Post-flight check:**
```sql
SELECT proname, proconfig FROM pg_proc
WHERE proname IN ('get_app_role','is_admin')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Both must show {search_path=public\, pg_temp} in proconfig

SELECT r.rolname, has_schema_privilege(r.rolname, 'public', 'CREATE') AS has_create
FROM pg_roles r WHERE r.rolname IN ('authenticated','anon');
-- Both must show false
```

**Smoke test:** Log in as a buyer. The login should succeed (is_admin() is called during session resolution). Admin login should also succeed.

---

### Step 2 — Migration 02 (H1)

**Pre-flight check:**
```sql
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'order_items'
  AND policyname = 'buyers_insert_order_items';
-- Expected: 0
```

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "buyers_insert_order_items" ON public.order_items;

REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon;
```

**Post-flight check:**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'order_items'
  AND grantee IN ('authenticated','anon')
  AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- Expected: 0 rows
```

**Smoke test:** Place a test order as a buyer through the normal checkout flow. The order should complete successfully (checkout uses service_role, which bypasses grants).

---

### Step 3 — Migration 03 (H2)

**Pre-flight check:**
```sql
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'payments'
  AND policyname = 'buyers_insert_own_payments';
-- Expected: 0
```

**Migration SQL:**
```sql
DROP POLICY IF EXISTS "buyers_insert_own_payments" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon;
```

**Post-flight check:**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'payments'
  AND grantee IN ('authenticated','anon')
  AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- Expected: 0 rows
```

**Smoke test:** Submit a payment proof (EFT flow) as a buyer. The payment row should be created successfully via the server action (which uses service_role).

---

### Step 4 — SKIP Migration 04 (H7)

```
SKIP — admins_read_tenant_config policy already exists.
CREATE POLICY would error. All desired effects present.
```

**Verification before skipping:**
```sql
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenant_config'
ORDER BY policyname;
-- Must show: admins_read_tenant_config, admins_update_tenant_config
-- Must NOT show: all_read_tenant_config
```

---

### Step 5 — Migration 05 (H8)

**Pre-flight check:**
```sql
-- Confirm notes and assigned_to are NOT in SELECT grants
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'orders'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  AND column_name IN ('notes','assigned_to');
-- Expected: 0 rows (already excluded)
```

**Migration SQL:**
```sql
REVOKE SELECT ON public.orders FROM authenticated;
REVOKE SELECT ON public.orders FROM anon;

GRANT SELECT (
  id,
  reference_number,
  profile_id,
  status,
  payment_method,
  payment_status,
  subtotal,
  discount_amount,
  vat_amount,
  total_amount,
  shipping_address,
  buyer_reference,
  delivery_instructions,
  order_notes,
  confirmed_at,
  fulfilled_at,
  cancelled_at,
  created_at,
  updated_at
) ON public.orders TO authenticated;
```

**Post-flight check:**
```sql
SELECT column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'orders'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT'
ORDER BY column_name;
-- Must NOT contain 'notes' or 'assigned_to'
-- Must contain all 20 listed columns
```

**Smoke test:** Navigate to the buyer order history page. Orders should display correctly (all visible fields render). Log in as admin and open an order in the admin panel — `notes` and `assigned_to` should display correctly (admin uses service_role, bypasses column grants).

---

### Step 6 — Migration 06 (L9)

**Pre-flight check:**
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('generate_order_reference','handle_updated_at',
                  'validate_line_total','record_order_status_change')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: 4 rows
```

**Migration SQL:**
```sql
ALTER FUNCTION public.generate_order_reference()   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()          SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_line_total()        SET search_path = public, pg_temp;
ALTER FUNCTION public.record_order_status_change() SET search_path = public, pg_temp;
```

**Post-flight check:**
```sql
SELECT proname, proconfig FROM pg_proc
WHERE proname IN ('generate_order_reference','handle_updated_at',
                  'validate_line_total','record_order_status_change')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- All four must show search_path=public, pg_temp in proconfig
```

**Smoke test:** Place a test order. The order reference (e.g., `ARM-20260504-XXXX`) should be generated by `generate_order_reference()`. Confirm it appears in the order confirmation page.

---

### Step 7 — SKIP Migration 07 (L10)

```
SKIP — CRITICAL. Would downgrade create_order_atomic and strip shipping_address support.
All security effects (L10 guard, search_path, grants) are present in the production
function installed by migration 20260430150809.
```

**Verification before skipping:**
```sql
SELECT prosrc FROM pg_proc
WHERE proname = 'create_order_atomic'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Must contain: 'service_role' (L10 guard)
-- Must contain: 'shipping_address' (post-07 evolution — confirms skip is safe)
```

---

### Step 8 — SKIP Migration 08 (L11)

```
SKIP — All 5 audit triggers already exist. CREATE TRIGGER would error immediately.
```

**Verification before skipping:**
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_audit_payments','trg_audit_order_items',
                       'trg_audit_tenant_config','trg_audit_addresses',
                       'trg_audit_buyer_sessions')
GROUP BY trigger_name, event_object_table
ORDER BY event_object_table;
-- Expected: 5 rows (one per table)
```

---

### Step 9 — Migration 09 (M8)

**Pre-flight check:**
```sql
SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'product-images';
-- allowed_mime_types must NOT contain image/svg+xml
```

**Migration SQL:**
```sql
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'image/jpeg',
     'image/png',
     'image/webp',
     'image/gif'
   ]
 WHERE id = 'product-images';

DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
```

**Post-flight check:**
```sql
SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'product-images';
-- Must show exactly: {image/jpeg,image/png,image/webp,image/gif}

SELECT policyname, roles, qual FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'product_images_public_read';
-- Must return 1 row
```

**Smoke test:** Navigate to the product catalogue. Product images should load correctly. Attempt to upload an SVG via admin (if UI exposes this) — it should be rejected.

---

### Step 10 — Migration 10 (M9)

**Pre-flight check:**
```sql
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'payment-proofs';
-- Must return 1 row: public=false, limit=5242880
```

**Migration SQL:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_proofs_admin_read" ON storage.objects;
CREATE POLICY "payment_proofs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );
```

**Post-flight check:**
```sql
SELECT policyname, qual FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'payment_proofs_admin_read';
-- Must return 1 row; qual must reference is_admin()
```

**Smoke test:** Submit a payment proof as a buyer. The upload should succeed. Log in as admin — the payment proof should be viewable. As a buyer, direct storage access to another buyer's proof should be denied.

---

### Step 11 — Migration 11 (M6)

**Pre-flight check:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
  AND column_name = 'client_submission_id';
-- Expected: 1 row (column already exists)
```

**Migration SQL:**
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_submission_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_submission_id
  ON public.orders (client_submission_id)
  WHERE client_submission_id IS NOT NULL;
```

**Post-flight check:**
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'orders'
  AND indexname = 'idx_orders_client_submission_id';
-- Must return 1 row with partial unique index definition
```

**Smoke test:** Place a test order. The checkout should succeed. Attempt a double-submit (rapidly submit the same cart twice — this requires the checkout action to be sending a `client_submission_id`; verify in code that it does). The second submission should be silently rejected by the unique index constraint.

---

### Post-Deployment: Record Migrations in schema_migrations

After executing all steps above, insert the migration records so the local and remote state are consistent. Run in the Supabase SQL Editor:

```sql
-- Record all 11 Phase 1 migrations as applied.
-- Adjust statements column as appropriate (empty array is acceptable for tracking).
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260414_01', 'C1_pin_is_admin_search_path', ARRAY[]::text[]),
  ('20260414_02', 'H1_lock_down_order_items_writes', ARRAY[]::text[]),
  ('20260414_03', 'H2_lock_down_payments_writes', ARRAY[]::text[]),
  ('20260414_04', 'H7_lock_down_tenant_config', ARRAY[]::text[]),
  ('20260414_05', 'H8_lock_down_orders_columns', ARRAY[]::text[]),
  ('20260414_06', 'L9_pin_remaining_function_search_paths', ARRAY[]::text[]),
  ('20260414_07', 'L10_create_order_atomic_role_guard', ARRAY[]::text[]),
  ('20260414_08', 'L11_extend_audit_triggers', ARRAY[]::text[]),
  ('20260414_09', 'M8_lock_down_product_images_bucket', ARRAY[]::text[]),
  ('20260414_10', 'M9_create_payment_proofs_bucket', ARRAY[]::text[]),
  ('20260414_11', 'M6_add_client_submission_id', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
```

This prevents `supabase db push` from attempting to re-apply these migrations in the future.

---

## SECTION 4 — STOP-THE-LINE CONDITIONS

Halt immediately and do not proceed to the next migration if any of the following occur.

### 4.1 Any migration returns an error

**Exception:** Migrations 04, 07, and 08 are documented skips — encountering `42710: policy already exists` or `42710: trigger already exists` on these means you accidentally ran them. See rollback instructions.

**For all other migrations:** An error indicates unexpected state. Stop, investigate, and do not continue until the cause is understood.

**What to do:**
1. Copy the full error text
2. Run the pre-flight checks again to establish current state
3. Do NOT attempt to manually work around the error by modifying the SQL
4. Contact the developer who authored the migration

### 4.2 Post-flight check returns unexpected results

If a post-flight query does not return the documented expected result:
1. Do not proceed to the next migration
2. Run the smoke test anyway to determine if the application is affected
3. If the application is affected: execute the rollback SQL and restore prior state
4. If the application is not affected: document the discrepancy and escalate before continuing

### 4.3 Smoke test fails

Smoke test failures indicate the migration had an unintended side effect.

| Migration | Failure symptom | Immediate action |
|---|---|---|
| 01 | Buyers cannot log in; authentication errors | ROLLBACK: `ALTER FUNCTION public.get_app_role() RESET search_path; ALTER FUNCTION public.is_admin() RESET search_path;` |
| 02 | Checkout fails on order creation | ROLLBACK: `GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated;` |
| 03 | Payment submission fails | ROLLBACK: `GRANT INSERT, UPDATE, DELETE ON public.payments TO authenticated;` |
| 05 | Order history page blank or errors | ROLLBACK: `GRANT SELECT ON public.orders TO authenticated;` |
| 06 | Orders not created (reference generation fails) | ROLLBACK: Reset all four functions' search_path |
| 09 | Product images not loading | Investigate storage policy — DROP POLICY "product_images_public_read" and recreate |
| 10 | Payment proof upload fails | Investigate bucket config |
| 11 | Checkout fails with unique constraint error | Investigate whether `client_submission_id` uniqueness is being violated incorrectly |

### 4.4 Unexpected application behaviour after any migration

If the application exhibits any unexpected behaviour not covered by the smoke tests:
1. Pause the deployment window
2. Do not roll forward
3. Assess whether the behaviour is linked to the last migration applied
4. If yes: execute the rollback SQL for that migration
5. If the rollback fails or the cause is unclear: engage the developer immediately

---

## SECTION 5 — TOTAL EFFORT ESTIMATE

| Activity | Time |
|---|---|
| Read this plan (first time) | 30–45 minutes |
| Read this plan (day-of-execution review) | 10 minutes |
| Per migration: run pre-flight + apply + post-flight | 2–3 minutes |
| Per migration: smoke test (app interaction) | 3–5 minutes |
| Total for 8 migrations (excl. 3 skips) | ~50–65 minutes |
| Total including reading and verification | ~90 minutes |

**Total deployment window: 2 hours** (buffer included for unexpected questions)

**Recommended deployment time:** Off-peak hours when active buyer session count is lowest. For a South African B2B portal, this is likely:
- Weekday early morning: 06:00–07:00 SAST
- Saturday morning: 07:00–08:00 SAST
- Any time on Sunday

None of the 8 applied migrations takes an ACCESS EXCLUSIVE lock for more than a fraction of a second. The REVOKE/GRANT operations are instantaneous. There is no requirement for a maintenance window or application downtime, but low-traffic timing is prudent.

---

## SECTION 6 — OPEN QUESTIONS FOR THE DEVELOPER

The following cannot be determined from the codebase or live schema inspection and require human confirmation before executing.

### Q1 — Is point-in-time recovery (PITR) configured on the production Supabase project?

**Why it matters:** If PITR is enabled, you have a rollback option that does not require manual SQL — restore to a snapshot taken immediately before the deployment. If it is not enabled, the per-migration rollback SQL in this document is your only recovery path.

**Action:** Check in Supabase dashboard → Project → Settings → Add-ons. If PITR is not enabled and you want an additional safety net, enable it before executing (it takes effect immediately for new backups).

### Q2 — Are there active buyer sessions that should be notified?

**Why it matters:** Migrations 02 and 03 revoke INSERT/UPDATE/DELETE on `order_items` and `payments` from `authenticated`. Any buyer currently mid-checkout could receive an error if their request hits the DB between the REVOKE and the end of their session. Given that all application checkout code uses service_role (admin client), this risk is theoretical — but worth confirming.

**Action:** Check current active session count in Supabase Auth dashboard. If significant session volume, schedule during the identified low-traffic window. No migration window announcement to buyers is required.

### Q3 — Should the migration deployment be communicated to the client (business owner)?

**Why it matters:** While these migrations are security hardening with no user-visible changes, the client may prefer to be informed of any production database operations.

**Action:** Developer's judgement call based on client relationship and communication preferences.

### Q4 — Has the `client_submission_id` field been wired up in `checkoutAction`?

**Why it matters:** Migration 11 adds the column and unique index. The idempotency guarantee only works if `checkoutAction` in `src/app/actions/checkout.ts` actually populates `client_submission_id` when calling `create_order_atomic`. If it does not, the column exists but provides no protection against double-orders.

**Action:** Verify in `src/app/actions/checkout.ts` that `p_order` passed to `create_order_atomic` includes a `client_submission_id` value. If not, this is a follow-up task: generate a UUID client-side (or server-side) and pass it with each checkout submission.

### Q5 — Has the `schema_migrations` INSERT (Section 3, post-deployment) been reviewed?

**Why it matters:** The `INSERT INTO supabase_migrations.schema_migrations` step records these migrations as applied so `supabase db push` does not attempt to re-run them. The `statements` column is set to `ARRAY[]::text[]` (empty) because the SQL is already present in the migration files. Confirm this is acceptable for your Supabase project's migration tooling.

### Q6 — Bonus finding: `orders` realtime policy has `qual = true`

**Why it matters:** The policy `Authenticated users receive order changes` on `orders` has `USING (true)` — any authenticated user can SELECT all orders via this policy (not just their own). This is likely a Supabase Realtime subscription policy added automatically. Column-level grants limit visible fields (notes and assigned_to are excluded), but a buyer could use the Supabase anon/authenticated client to read all orders' visible columns.

This is **out of scope for Phase 1** (it was not in the original audit's findings list) but should be addressed in Phase 2. Confirm with the developer whether this realtime policy is intentional or should be restricted.

---

*End of plan. Do not execute until the developer has reviewed and approved.*
