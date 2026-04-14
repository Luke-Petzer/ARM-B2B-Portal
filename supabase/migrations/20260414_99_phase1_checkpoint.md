# Security Remediation — Phase 1 Checkpoint (2026-04-14)

Phase 1 covers DB-level fixes. All migrations written against branch
`security/remediation-2026-04-14` and must be applied **in filename order**:

| # | Finding | File | Summary |
|---|---------|------|---------|
| 1 | **C1** | `20260414_01_C1_pin_is_admin_search_path.sql` | Pin `search_path` on `is_admin()`/`get_app_role()`; revoke CREATE on public schema. |
| 2 | **H1** | `20260414_02_H1_lock_down_order_items_writes.sql` | Drop buyer INSERT policy on `order_items`; revoke writes. |
| 3 | **H2** | `20260414_03_H2_lock_down_payments_writes.sql` | Drop buyer INSERT policy on `payments`; revoke writes. |
| 4 | **H7** | `20260414_04_H7_lock_down_tenant_config.sql` | Drop permissive `tenant_config` SELECT; admin-only. |
| 5 | **H8** | `20260414_05_H8_lock_down_orders_columns.sql` | Column-level grants hide `notes`/`assigned_to` from buyers. |
| 6 | **L9** | `20260414_06_L9_pin_remaining_function_search_paths.sql` | Pin search_path on remaining trigger/helper functions. |
| 7 | **L10** | `20260414_07_L10_create_order_atomic_role_guard.sql` | Runtime `service_role`-only assertion in `create_order_atomic`. |
| 8 | **L11** | `20260414_08_L11_extend_audit_triggers.sql` | Audit triggers on payments/order_items/tenant_config/addresses/buyer_sessions. |
| 9 | **M8** | `20260414_09_M8_lock_down_product_images_bucket.sql` | Remove SVG from product-images; add explicit public-read policy. |
| 10 | **M9** | `20260414_10_M9_create_payment_proofs_bucket.sql` | Provision private payment-proofs bucket with strict defaults. |

Additionally, **H6** (`.gitignore supabase/scripts` + env guard on
`seed_test_users.sql`) is a file-system change, committed separately.

## Application order

1. Check out branch `security/remediation-2026-04-14`.
2. In Supabase SQL editor (or `supabase db push`), run each migration in
   the order above. They are idempotent: safe to re-run.
3. Verify via the post-apply checks below.

## Post-apply verification (run in SQL editor)

```sql
-- C1: search_path pinned on is_admin / get_app_role
SELECT proname, proconfig
FROM pg_proc
WHERE proname IN ('is_admin','get_app_role','generate_order_reference',
                  'handle_updated_at','validate_line_total',
                  'record_order_status_change','create_order_atomic');
-- Expect proconfig to contain 'search_path=public, pg_temp' on every row.

-- H1: no buyer insert policy on order_items
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='order_items';
-- Expect only 'select_order_items' and 'admins_update_order_items'.

-- H2: no buyer insert policy on payments
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='payments';
-- Expect only select/update/delete admin policies.

-- H7: tenant_config admin-only read
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='tenant_config';
-- Expect 'admins_read_tenant_config' and 'admins_update_tenant_config' only.

-- H8: authenticated can only see whitelisted columns on orders
SELECT column_name FROM information_schema.column_privileges
WHERE grantee='authenticated' AND table_schema='public' AND table_name='orders'
  AND privilege_type='SELECT'
ORDER BY column_name;
-- Expect the 19-column allowlist from the migration. NO 'notes', NO 'assigned_to'.

-- L11: audit triggers present on new tables
SELECT event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_audit_%'
ORDER BY event_object_table;
-- Expect: addresses, buyer_sessions, order_items, orders, payments,
-- products, profiles, tenant_config.

-- M8: SVG removed from product-images
SELECT allowed_mime_types FROM storage.buckets WHERE id='product-images';
-- Expect: {image/jpeg,image/png,image/webp,image/gif}

-- M9: payment-proofs exists, private
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='payment-proofs';
-- Expect: public=false, file_size_limit=5242880, types including application/pdf.
```

## Known caveats

- **Docker unavailable locally** during this remediation — migrations
  could not be applied against a live DB. Each SQL file was hand-validated
  against the existing schema in `supabase/init.sql` and follows the same
  syntactic patterns as already-merged migrations (e.g. emergency_hardening).
- Phase 1 does not include app code changes. Phase 2 adds Zod schemas,
  file validation, defensive auth checks. Phase 3 adds proxy/rate-limiter
  and architectural changes.

## Phase 2 preview (server-side code)

H3, H4, M5, M10, M11, M12, L1, L3, L4, L5, L6, L7

## Phase 3 preview (auth/arch)

H5, M1, M2, M3, M4, M6, M7, M13, M14, M15
