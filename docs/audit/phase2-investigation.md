# Phase 2 Hardening — FORCE RLS Impact Investigation

> Branch: `investigate/phase2-force-rls-impact`
> Created: 2026-05-04
> Status: **Investigation complete — awaiting developer review before migration is produced**

---

## Objective

Determine whether enabling `FORCE ROW LEVEL SECURITY` on all 14 tables will break any existing
admin or system write path. Map every write operation, confirm which role performs it, and verify
whether that role has `rolbypassrls = true` (which exempts it from FORCE RLS unconditionally).

Additionally, identify all SECURITY DEFINER functions with a `search_path` that does not include
`pg_temp`, and flag those for hardening against search-path injection.

---

## Key Finding — FORCE RLS Will NOT Break Any Existing Operation

Both roles that perform writes in this application have `rolbypassrls = true`:

| Role | rolsuper | rolbypassrls | Effect under FORCE RLS |
|---|---|---|---|
| `postgres` | false | **true** | Bypasses FORCE RLS unconditionally |
| `service_role` | false | **true** | Bypasses FORCE RLS unconditionally |
| `authenticated` | false | false | Subject to RLS (and FORCE RLS) — buyers |
| `supabase_admin` | true | true | Bypasses FORCE RLS |

**PostgreSQL rule:** `FORCE ROW LEVEL SECURITY` removes the owner/superuser bypass — but roles
with `rolbypassrls = true` bypass RLS regardless of FORCE RLS. Since `postgres` and `service_role`
both have `rolbypassrls = true`, enabling FORCE RLS on any table has zero effect on any operation
performed by either role.

**Consequence:** No new permissive policies are needed. No existing server action or trigger will
be blocked. The only deliverable from enabling FORCE RLS is defense-in-depth (if a future
migration accidentally grants the table owner write access to a role without BYPASSRLS, it will
not silently bypass buyer-facing policies).

---

## Current Table State

All 14 tables queried from the live database:

| Table | rls_enabled | force_rls |
|---|---|---|
| addresses | true | false |
| audit_log | true | false |
| buyer_sessions | true | false |
| categories | true | false |
| client_custom_prices | true | false |
| global_settings | true | false |
| order_items | true | false |
| order_status_history | true | false |
| orders | true | false |
| payments | true | false |
| product_images | true | false |
| products | true | false |
| profiles | true | false |
| tenant_config | true | false |

All 14 tables have RLS enabled but `force_rls = false`. The migration will set `force_rls = true`
on all 14.

---

## Admin-Client Write Path Inventory

All server actions use the Supabase `service_role` client (`adminClient`). Because `service_role`
has `rolbypassrls = true`, every write below is unaffected by FORCE RLS.

### `categories`

| Operation | Source | Role |
|---|---|---|
| INSERT | `createCategory` — `src/app/actions/admin.ts:65` | service_role |

### `orders`

| Operation | Source | Role |
|---|---|---|
| UPDATE (assign buyer) | `assignBuyerToOrderAction` — admin.ts | service_role |
| UPDATE (approve) | `approveOrderAction` — admin.ts | service_role |
| UPDATE (cancel) | `cancelOrderAction` — admin.ts | service_role |
| UPDATE (mark settled) | `markOrderSettledAction` — admin.ts | service_role |
| UPDATE (bulk settle) | `bulkSettleOrdersAction` — admin.ts | service_role |
| UPDATE (idempotency stamp) | `submitOrderAction` — checkout.ts | service_role |

### `order_items`

No direct writes from server actions. All order_items rows are created exclusively through the
`create_order_atomic` RPC (a SECURITY DEFINER function running as `postgres`, which has
`rolbypassrls = true`).

### `profiles`

| Operation | Source | Role |
|---|---|---|
| UPDATE (admin role) | `updateAdminRole` — admin.ts | service_role |
| UPDATE (client data) | `updateClientAction` — admin.ts | service_role |
| UPDATE (discount %) | `updateClientDiscountPct` — admin.ts | service_role |

### `products`

| Operation | Source | Role |
|---|---|---|
| INSERT | `createProduct` — admin.ts | service_role |
| UPDATE | `updateProductAction` — admin.ts | service_role |
| UPDATE (toggle active) | `toggleProductActiveAction` — admin.ts | service_role |

### `product_images`

| Operation | Source | Role |
|---|---|---|
| INSERT | image management action — admin.ts | service_role |
| UPDATE | image management action — admin.ts | service_role |

### `audit_log`

| Operation | Source | Role |
|---|---|---|
| INSERT (direct) | `updateProductAction` — admin.ts:951 (`adminClient as any`) | service_role |
| INSERT (trigger-driven) | `log_table_audit` SECURITY DEFINER trigger | postgres (BYPASSRLS) |

**Note:** `audit_log` has no INSERT policy. This is safe because all inserts come from roles with
`rolbypassrls = true`. The `adminClient as any` cast bypasses TypeScript's type system but does
not bypass BYPASSRLS — the operation uses service_role throughout.

Trigger coverage: `log_table_audit` fires on the following tables:
`addresses`, `buyer_sessions`, `order_items`, `orders`, `payments`, `products`, `profiles`,
`tenant_config`

### `tenant_config`

| Operation | Source | Role |
|---|---|---|
| UPDATE | `updateTenantConfig` — admin.ts | service_role |

### `global_settings`

| Operation | Source | Role |
|---|---|---|
| UPDATE | `saveGlobalBanner` — admin.ts | service_role |

### `client_custom_prices`

| Operation | Source | Role |
|---|---|---|
| UPSERT | `setClientCustomPrice` — admin.ts | service_role |
| DELETE | `removeClientCustomPrice` — admin.ts | service_role |

### `payments`

| Operation | Source | Role |
|---|---|---|
| INSERT | `submitOrderAction` — checkout.ts:549 | service_role |

**Note:** `payments` has no INSERT policy. Safe — service_role has `rolbypassrls = true`.

### `addresses`

| Operation | Source | Role |
|---|---|---|
| INSERT | `addAddressAction` — addresses.ts:41 | service_role |

### `buyer_sessions`

No direct server-action writes found. Populated by Supabase Auth internals (service_role) and
potentially by SECURITY DEFINER triggers. No INSERT policy exists. Safe — all writes via
BYPASSRLS roles.

### `order_status_history`

No direct server-action writes found. Only SELECT policies exist. If rows are created by a
SECURITY DEFINER function or trigger (uses postgres BYPASSRLS), this is safe. Requires confirmation
that no authenticated-role write path exists.

---

## Tables With No INSERT Policy

These tables have `rls_enabled = true` but no INSERT RLS policy:

| Table | Write source | Why safe |
|---|---|---|
| `audit_log` | service_role (adminClient) + postgres (trigger) | Both have rolbypassrls=true |
| `payments` | service_role (checkout.ts:549) | service_role has rolbypassrls=true |
| `buyer_sessions` | Supabase Auth internals | service_role has rolbypassrls=true |
| `order_status_history` | Unknown / trigger-driven | Needs confirmation; currently no writes found |

**FORCE RLS does not change this.** A missing INSERT policy only matters for roles without
BYPASSRLS. `authenticated` buyers have no INSERT access to any of these tables, which is correct.

---

## SECURITY DEFINER Functions — search_path Audit

SECURITY DEFINER functions run with the privileges of their owner (`postgres`, which has
`rolbypassrls = true`). A function with a non-hardened `search_path` can be attacked via
search-path injection: a malicious schema inserted before `public` in `search_path` can shadow
standard objects with attacker-controlled versions.

The fix is to add `pg_temp` to `search_path`, which is the last-resort schema and prevents any
schema installed after function creation from being picked up first.

### Functions requiring search_path hardening

| Function | Current search_path | Required |
|---|---|---|
| `handle_new_buyer_user` | `search_path=public` | `search_path=public, pg_temp` |
| `handle_new_admin_user` | `search_path=public` | `search_path=public, pg_temp` |
| `custom_access_token_hook` | `search_path=public` | `search_path=public, pg_temp` |
| `log_table_audit` | `search_path=public` | `search_path=public, pg_temp` |

### Already correct

| Function | Current search_path | Status |
|---|---|---|
| `create_order_atomic` | `search_path=public, pg_temp` | ✅ Already hardened |

---

## Stop Conditions

The following conditions would have required stopping this investigation and escalating before
proceeding:

| Condition | Observed? | Notes |
|---|---|---|
| Any role without BYPASSRLS performing admin writes | No | service_role and postgres both have rolbypassrls=true |
| SECURITY DEFINER function calling another function via `public.` prefix only | No | No cross-function calls found without qualified references |
| RLS policy relying on `current_user` in a way that breaks under FORCE RLS | No | Policies use `auth.uid()` which is unaffected |
| Table owner != postgres | No | All tables owned by postgres |

No stop conditions triggered.

---

## Proposed Migration Scope

> **This is not the migration. This is a description for developer review.**
> The migration will be produced on branch `fix/phase2-hardening` after this document is reviewed.

### Part 1 — Enable FORCE RLS on all 14 tables

```sql
ALTER TABLE public.addresses          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_sessions     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_custom_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_images     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config      FORCE ROW LEVEL SECURITY;
```

**Expected impact:** None. Both `postgres` and `service_role` have `rolbypassrls = true`.

### Part 2 — Harden search_path on 4 SECURITY DEFINER functions

Add `pg_temp` to `search_path` for the 4 functions listed above. The `ALTER FUNCTION` statement
for each replaces only the `search_path` config setting — no function body changes.

```sql
ALTER FUNCTION public.handle_new_buyer_user()     SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_admin_user()     SET search_path = public, pg_temp;
ALTER FUNCTION public.custom_access_token_hook(jsonb, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_table_audit()           SET search_path = public, pg_temp;
```

**Expected impact:** None on functionality. Closes search-path injection vector.

---

## Developer Review Checklist

Before the migration is produced, please confirm:

- [ ] The role mapping is correct: `service_role` and `postgres` have `rolbypassrls=true` in your
      Supabase project (queried live; see `SQL-Results.md` for raw output).
- [ ] No server action writes to any table using the `authenticated` JWT role directly (confirmed
      from codebase scan above — all admin writes use `adminClient` which is service_role).
- [ ] `order_status_history` — confirm there are no INSERT paths from `authenticated` users or
      server actions that use the anon/buyer client. Current scan found no writes; this table
      appears to be populated only by triggers or admin-role operations.
- [ ] The `search_path` hardening for the 4 functions is acceptable — no custom schemas are
      intentionally loaded into `search_path` for those functions beyond `public`.
- [ ] Confirm whether `buyer_sessions` receives any direct INSERT from authenticated buyers
      (e.g., via a client-side SDK call). If so, an INSERT policy may be needed before FORCE RLS
      is enabled, even though FORCE RLS won't affect service_role.

---

## Conclusion

FORCE RLS is safe to enable on all 14 tables. No existing server action or trigger write path will
be blocked. The `search_path` hardening on 4 SECURITY DEFINER functions closes an injection vector
without changing any functional behavior. The migration can proceed after developer review of the
checklist above.
