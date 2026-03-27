# B2B Portal — Security & Quality Audit Report

> **Living document.** Updated after each audit chunk completes.
> Branch: `audit/codebase-review-and-tests`
> Started: 2026-03-27

---

## Audit Status Overview

| Chunk | Scope | Status | Tests Written | Issues Found | Issues Fixed |
|-------|-------|--------|---------------|--------------|--------------|
| P1 | Secret Sanitization | ✅ Complete | 4 | 1 Critical | 1 Fixed |
| P2 | Financial Integrity (Checkout) | ✅ Complete | 40+ | 2 High | 2 Fixed |
| C1 | Authentication & Session Security | 🔲 Pending | — | — | — |
| C2 | Authorization & RLS Enforcement | 🔲 Pending | — | — | — |
| C4 | Order State Machine | 🔲 Pending | — | — | — |
| C5 | Credit System | 🔲 Pending | — | — | — |
| C6 | API Routes & PDF/Report | 🔲 Pending | — | — | — |
| C7 | Code Quality & Technical Debt | 🔲 Pending | — | — | — |

---

## Security Health Check — P1: Secret Sanitization

### Findings

| ID | Severity | File | Issue | Status |
|----|----------|------|-------|--------|
| SEC-001 | 🔴 CRITICAL | `src/lib/supabase/config.ts` | Missing `import "server-only"` — `supabaseServiceRoleKey` (Supabase service role) could be included in client bundle if accidentally imported by a React component | ✅ Fixed |
| SEC-002 | 🟡 MEDIUM | `src/app/actions/checkout.ts:337` | `SUPABASE_SERVICE_ROLE_KEY` referenced directly in broadcast fetch (not via `adminClient`). Acceptable because file has `"use server"` directive, but noted for awareness | ✅ Mitigated (server-only context) |

### What Was Fixed

**SEC-001 — `config.ts` server-only guard:**
- **Root cause:** `config.ts` exported the service role key but had no `server-only` import. Next.js would include this in the client bundle if any client component transitively imported it.
- **Fix:** Added `import "server-only"` as the first import in `config.ts`.
- **Verification:** `admin.ts` already had `import "server-only"` — confirmed. `server.ts` (anon client) correctly does not export the service role key.
- **Test:** `tests/audit/security/secret-boundary.test.ts` — 4 tests, all passing.

### Inventory of Secret Usage

| Secret | File | Import Pattern | Server-Only Guard |
|--------|------|----------------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/config.ts` | Exported as `supabaseServiceRoleKey` | ✅ `server-only` (added by audit) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` | Imported from config | ✅ `server-only` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/app/actions/checkout.ts:337` | `process.env.SUPABASE_SERVICE_ROLE_KEY!` (broadcast) | ✅ `"use server"` directive |
| `SUPABASE_JWT_SECRET` | `src/lib/auth/buyer.ts` | `process.env.SUPABASE_JWT_SECRET` | ✅ `server-only` |
| `RESEND_API_KEY` | `src/app/actions/checkout.ts` | `process.env.RESEND_API_KEY` | ✅ `"use server"` directive |
| `CRON_SECRET` | `src/app/api/cron/daily-report/route.ts` | `process.env.CRON_SECRET` | ✅ Route Handler (server-only) |

---

## Security Health Check — P2: Financial Integrity (Checkout)

### Findings

| ID | Severity | File | Issue | Status |
|----|----------|------|-------|--------|
| FIN-001 | 🟠 HIGH | `src/app/actions/checkout.ts` | Financial calculation logic (`computeEffectiveUnitPrice`, `r2`) embedded inside server action — cannot be unit-tested in isolation | ✅ Fixed — extracted to `src/lib/checkout/pricing.ts` |
| FIN-002 | 🟠 HIGH | `src/app/actions/checkout.ts` | Product fetch does not filter by `is_active` — a deactivated product can still be purchased if it was in the cart before deactivation | ✅ Fixed — `is_active` guard added |
| FIN-003 | 🟢 LOW | `src/lib/cart/store.ts` | Client-side `getEffectiveUnitPrice` used for UI display — intentionally differs from server computation in edge cases (float rounding) | ✅ Accepted (server is authoritative; client is display-only) |

### Inventory Logic (Zombie Stock Audit)

| Field | Referenced in `checkoutAction`? | Risk |
|-------|--------------------------------|------|
| `stock_qty` | ❌ No | No risk — stock never blocks checkout |
| `low_stock_alert` | ❌ No | No risk |
| `track_stock` | ❌ No | No risk |
| `is_active` | ✅ Yes (added by audit) | Now correctly blocks inactive products |

**Verdict:** The inventory "zombie" logic (stock tracking schema present but not enforced) cannot accidentally block orders or cause DB rollbacks. The `create_order_atomic` Postgres function does not reference stock columns. **Zero risk from zombie stock logic.**

### Email Failure Isolation Audit

| Check | Result |
|-------|--------|
| `dispatchFulfillmentEmails` called with `.catch()` | ✅ Yes — errors cannot propagate to caller |
| Individual Resend email errors caught with `if (error)` | ✅ Yes — logged, not re-thrown |
| PDF generation inside helper (not before DB commit) | ✅ Yes — `renderInvoiceToBuffer` only called after `create_order_atomic` returns |
| Order redirect depends on email success | ❌ No (correct) — redirect happens regardless |
| `await dispatchFulfillmentEmails` anywhere | ❌ None found (correct) |

**Verdict:** Email failures are fully isolated. A Resend API outage, PDF rendering error, or network failure will log to console but will never roll back or abort a committed order. The user will always be redirected to the payment/confirmation page.

### Financial Calculation Test Coverage

| Function | Tests | Edge Cases Covered |
|----------|-------|--------------------|
| `r2()` | 5 | zero, negative, large, integer, fractional |
| `computeEffectiveUnitPrice()` | 16 | no discount, % discount, fixed discount, boundaries, clamping, string price, Infinity, zero price |
| `computeLineItem()` | 6 | no discount, % discount, fixed discount, zero price, large qty, fractional |
| `computeOrderTotals()` | 6 | 15% VAT, 0% VAT, empty cart, rounding, multi-item, drift check |

---

## Outstanding Issues (Backlog)

| ID | Severity | Issue | Planned Chunk |
|----|----------|-------|---------------|
| SEC-003 | 🔴 CRITICAL | `SUPABASE_JWT_SECRET` shared between buyer JWT creation and Supabase DB — if leaked, anyone can forge buyer tokens | C1 |
| SEC-004 | 🟠 HIGH | `buyer_sessions` revocation table present but not wired — tokens cannot be invalidated before 24h expiry | C1 |
| SEC-005 | 🟡 MEDIUM | Rate limiting uses `x-forwarded-for` which can be spoofed behind misconfigured proxies | C1 |
| FIN-004 | 🟡 MEDIUM | `available_credit` not auto-decremented on order confirmation — manual admin process creates accounting risk | C5 |
| FIN-005 | 🟡 MEDIUM | No idempotency key on `checkoutAction` — rapid double-submit can create duplicate orders | C4 |
| AUD-001 | 🟢 LOW | `audit_log` rows can be deleted by service-role — no immutability constraint | C7 |
| AUD-002 | 🟢 LOW | No GDPR/data retention policy | C7 |
| AUD-003 | 🟢 LOW | No Two-Factor Authentication for admin accounts | C1 |

---

## Test Suite Summary

```
tests/audit/
├── setup.ts                              # vi.mock stubs for Next.js runtime
├── security/
│   └── secret-boundary.test.ts           # 4 tests — P1 complete
├── financial/
│   └── pricing.test.ts                   # 33 tests — P2 complete
├── email/
│   └── fulfillment-isolation.test.ts     # 6 tests — P2 complete
└── inventory/
    └── zombie-stock.test.ts              # 5 tests — P2 complete
```

**Total tests written (P1+P2): 48**
**Pass rate: 100%**

---

## Methodology

Each chunk follows the **Verify → Test → Fix → Re-Verify** loop:

1. **Verify:** Read source files. Identify actual vs expected behavior.
2. **Test:** Write failing tests first (TDD — red phase).
3. **Fix:** Implement minimal fix to make tests pass (green phase).
4. **Re-Verify:** Run full suite to confirm no regressions.

Static analysis tests (file content assertions) are used where runtime execution would require mocking the entire Next.js + Supabase stack. Pure-function tests use direct imports.

---

*Last updated: 2026-03-27 — P1 & P2 complete*
