-- ============================================================
-- Feature Batch: Employee Triage, Credit Hardening, Dispatch
-- Applied: 2026-03-25
-- ============================================================

-- 1. Cost price on products (selling margin tracking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);

-- 2. Cost price snapshot on order_items (captured at checkout time)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);

-- 3. Admin sub-role (manager vs employee, only relevant when role = 'admin')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role TEXT
  DEFAULT 'employee'
  CHECK (admin_role IN ('manager', 'employee'));

-- 4. Order assignment trail (which admin employee is handling this order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID
  REFERENCES profiles(id) ON DELETE SET NULL;

-- 5. Extend payment_status to include credit_approved
--    credit_approved = 30-day account order recognised as revenue (within credit period)
--    paid            = immediate payment received (EFT proof verified OR 30-day settling now)
--    unpaid          = order placed, no payment action yet
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid', 'credit_approved'));

-- 6. New tenant_config fields
--    dispatch_email : email address for the dispatch/warehouse team
--    report_emails  : comma-separated list for daily revenue report delivery (wired up later)
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS dispatch_email TEXT;
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS report_emails  TEXT;
