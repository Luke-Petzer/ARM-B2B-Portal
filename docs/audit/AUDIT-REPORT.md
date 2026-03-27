# B2B Portal — Security & Quality Audit Report

> **Living document.** Updated after each audit chunk completes.
> Branch: `main` (merged 2026-03-27)
> Started: 2026-03-27

---

## Audit Status Overview

| Chunk | Scope | Status | Tests | Issues Found | Issues Fixed |
|-------|-------|--------|-------|--------------|--------------|
| P1 | Secret Sanitization | ✅ Complete | 5 | 1 Critical | 1 Fixed |
| P2 | Financial Integrity (Checkout) | ✅ Complete | 40+ | 2 High | 2 Fixed |
| C1 | Authentication & Session Security | ✅ Complete | 51 | 4 | 1 Fixed |
| C2 | Authorization & RLS Enforcement | ✅ Complete | 28 | 1 Critical | 1 Fixed |
| C4 | Order State Machine | ✅ Complete | 26 | 2 Medium | 0 (documented) |
| C5 | Credit System | ✅ Complete | 24 | 3 | 3 Fixed |
| C6 | API Routes & PDF/Report | ✅ Complete | 23 | 1 Medium | 0 (documented) |
| C7 | Code Quality & Technical Debt | ✅ Complete | 9 | 1 Low | 1 Fixed |

**Total tests (all chunks): 237 passing**

---

## Security Health Check — P1: Secret Sanitization

### Findings

| ID | Severity | File | Issue | Status |
|----|----------|------|-------|--------|
| SEC-001 | 🔴 CRITICAL | `src/lib/supabase/config.ts` | Missing `import "server-only"` — `supabaseServiceRoleKey` could be included in client bundle if accidentally imported by a React component | ✅ Fixed |
| SEC-002 | 🟡 MEDIUM | `src/app/actions/checkout.ts:337` | `SUPABASE_SERVICE_ROLE_KEY` referenced directly in broadcast fetch (not via `adminClient`). Acceptable because file has `"use server"` directive, but noted for awareness | ✅ Mitigated (server-only context) |

### What Was Fixed

**SEC-001 — Service role key moved out of shared `config.ts`:**
- **Root cause:** `config.ts` exported `supabaseServiceRoleKey` alongside the two `NEXT_PUBLIC_` vars. Because `browser.ts` and middleware import from `config.ts`, adding `server-only` there broke the build (Vercel Turbopack error: "server-only cannot be imported from a Client Component").
- **Fix (revised):** Removed `supabaseServiceRoleKey` from `config.ts` entirely. `admin.ts` (which already has `import "server-only"`) now reads `process.env.SUPABASE_SERVICE_ROLE_KEY` directly. `config.ts` is now intentionally NOT server-only — it only exports `NEXT_PUBLIC_` vars that are safe for browser/middleware use.
- **Test:** `tests/audit/security/secret-boundary.test.ts` — 5 tests, all passing.

### Inventory of Secret Usage

| Secret | File | Import Pattern | Server-Only Guard |
|--------|------|----------------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` | `process.env.SUPABASE_SERVICE_ROLE_KEY` (direct, not re-exported) | ✅ `server-only` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/app/actions/checkout.ts:337` | `process.env.SUPABASE_SERVICE_ROLE_KEY!` (broadcast) | ✅ `"use server"` directive |
| `SUPABASE_JWT_SECRET` | `src/lib/auth/buyer.ts` | `process.env.SUPABASE_JWT_SECRET` | ✅ `server-only` |
| `RESEND_API_KEY` | `src/app/actions/checkout.ts` | `process.env.RESEND_API_KEY` | ✅ `"use server"` directive |
| `CRON_SECRET` | `src/app/api/cron/daily-report/route.ts` | `process.env.CRON_SECRET` | ✅ Route Handler (server-only) |

---

## Security Health Check — P2: Financial Integrity (Checkout)

### Findings

| ID | Severity | File | Issue | Status |
|----|----------|------|-------|--------|
| FIN-001 | 🟠 HIGH | `src/app/actions/checkout.ts` | Financial calculation logic embedded inside server action — could not be unit-tested in isolation | ✅ Fixed — extracted to `src/lib/checkout/pricing.ts` |
| FIN-002 | 🟠 HIGH | `src/app/actions/checkout.ts` | Product fetch did not filter by `is_active` — deactivated product could be purchased from a stale cart | ✅ Fixed — `is_active` guard added |
| FIN-003 | 🟢 LOW | `src/lib/cart/store.ts` | Client-side `getEffectiveUnitPrice` used for UI display — intentionally differs from server in edge cases | ✅ Accepted (server is authoritative; client is display-only) |

### Inventory Logic (Zombie Stock Audit)

| Field | Referenced in `checkoutAction`? | Risk |
|-------|--------------------------------|------|
| `stock_qty` | ❌ No | No risk — stock never blocks checkout |
| `low_stock_alert` | ❌ No | No risk |
| `track_stock` | ❌ No | No risk |
| `is_active` | ✅ Yes (added by audit) | Now correctly blocks inactive products |

**Verdict:** The `create_order_atomic` Postgres function does not reference stock columns. **Zero risk from zombie stock logic.**

### Email Failure Isolation Audit

| Check | Result |
|-------|--------|
| `dispatchFulfillmentEmails` called with `.catch()` | ✅ Yes — errors cannot propagate to caller |
| Individual Resend email errors caught with `if (error)` | ✅ Yes — logged, not re-thrown |
| PDF generation inside helper (not before DB commit) | ✅ Yes — `renderInvoiceToBuffer` only called after `create_order_atomic` returns |
| Order redirect depends on email success | ❌ No (correct) — redirect happens regardless |

**Verdict:** Email failures are fully isolated. A Resend outage will never roll back or abort a committed order.

### Financial Calculation Test Coverage

| Function | Tests | Edge Cases Covered |
|----------|-------|--------------------|
| `r2()` | 5 | zero, negative, large, integer, fractional |
| `computeEffectiveUnitPrice()` | 16 | no discount, % discount, fixed discount, boundaries, clamping, string price, Infinity, zero price |
| `computeLineItem()` | 6 | no discount, % discount, fixed discount, zero price, large qty, fractional |
| `computeOrderTotals()` | 6 | 15% VAT, 0% VAT, empty cart, rounding, multi-item, drift check |

---

## Security Health Check — C1: Authentication & Session Security

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| AUTH-001 | 🔴 CRITICAL (LIVE BUG) | `"unknown"` IP fallback creates shared rate-limit bucket — entire office/VPN lockout after 5 failed attempts by any one account | ✅ Fixed — fallback scoped to `unknown:${accountNumber}` |
| AUTH-002 | 🟠 HIGH | `secure` cookie flag tied to `NODE_ENV === "production"` — if production serves over HTTP the session cookie is silently dropped (looks like login loop) | ⚠️ Operator must verify TLS enforced at edge |
| AUTH-003 | 🟡 MEDIUM | Corporate proxy stripping `Set-Cookie` from `307` redirects = persistent login loop | ⚠️ Secondary candidate for client login issue |
| AUTH-004 | 🟡 MEDIUM | JWT revocation not implemented — 24h token valid even after logout | Documented (accepted trade-off for stateless auth) |
| AUTH-005 | 🟢 LOW | `x-real-ip` header not consulted — some nginx/ALB setups use this instead of `x-forwarded-for` | Monitor post-deploy |

### What Was Fixed

**AUTH-001 — IP bucket collapse:**
- **Root cause:** `headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"` — when `x-forwarded-for` is absent (corporate NAT, VPN, Cloudflare privacy), all users resolve to the literal string `"unknown"`. Five failed attempts by one person exhausted `portal:login:unknown` and locked out every user on the same egress point.
- **Fix:** Fallback is now `` `unknown:${accountNumber}` `` — lockout scoped to the specific account being targeted.
- **Test:** `tests/audit/auth/rate-limit.test.ts` — 11 tests, all passing.

### Test Coverage — C1

| Area | Tests | Notes |
|------|-------|-------|
| JWT claim structure (sub/role/aud/iss/app_role/account_number) | 8 | `createBuyerSession` verified with `jose` |
| JWT expiry (24h) | 2 | `exp` and `iat` timing verified |
| `verifyBuyerSession` rejection paths | 7 | expired, tampered, wrong secret, missing claims, invalid string |
| Cookie security properties | 5 | httpOnly, sameSite=lax, path=/, maxAge=86400, secure=production |
| Account number format validation | 22 | Valid formats, length boundaries, lowercase→uppercase normalisation |
| Rate limit return shapes | 3 | allowed true/false, retryAfter, fail-open on Redis error |
| IP extraction patterns | 4 | split(",")[0], .trim(), unknown bucket fix, noop limiter |

---

## Security Health Check — C5: Credit System

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| C5-01 | 🟠 HIGH | Credit display included pending orders (not yet confirmed by admin) — overstated the outstanding balance | ✅ Fixed — query now requires `confirmed_at IS NOT NULL` |
| C5-02 | 🟡 MEDIUM | `credit_limit = 0` bypasses Rule 2 (guard is `creditLimit > 0`) — 0 means "COD / no credit allowed" and must always block | ✅ Fixed — Rule 2 now: `creditLimit === 0 \|\| outstanding > creditLimit` |
| C5-03 | 🟡 MEDIUM | Profile fetch error silently granted unlimited credit — no error logged | ✅ Fixed — `console.error` added |
| C5-04 | 🟠 HIGH | Credit display showed R 0,00 available when `credit_limit` is null — null defaulted to 0, making available = 0 − outstanding = negative → clamped to 0 | ✅ Fixed — null now shown as "No limit set" |
| C5-05 | 🟠 HIGH | Credit query only filtered `payment_status = "unpaid"` — missed `credit_approved` orders | ✅ Fixed — now uses `.in(["unpaid", "credit_approved"])` |

### What Was Fixed

**C5-01 / C5-04 / C5-05 — Credit display overhaul:**
- `page.tsx` orders query now: `.in("payment_status", ["unpaid", "credit_approved"]).not("confirmed_at", "is", null).neq("status", "cancelled")`
- `CreditDrawer.tsx`: `creditLimit` is now `null` when not configured; UI shows "No limit set" / "No credit limit configured" instead of R 0,00
- Consistent with `checkCreditStatus.ts` which uses the same `confirmed_at IS NOT NULL` pattern

**C5-02 — COD / no-credit limit enforcement:**
- **Product decision (2026-03-27):** `credit_limit = 0` means "Strictly COD / No Credit Allowed". Admins should never be able to approve credit for these accounts.
- **Fix:** Rule 2 condition changed from `creditLimit != null && creditLimit > 0 && outstanding > creditLimit` to `creditLimit != null && (creditLimit === 0 || outstanding > creditLimit)`.
- Three credit limit behaviours are now explicitly enforced: `null` = unlimited (skip check), `0` = always block regardless of balance, `> 0` = block if outstanding exceeds limit.
- Tests R2-5, R2-6, R2-7 updated to expect `blocked: true` for `creditLimit = 0`.

**Buyer protection confirmed:** `checkCreditStatus` is admin-only and is never called in the buyer checkout flow. Buyers cannot be blocked by credit status.

### Test Coverage — C5

| Area | Tests |
|------|-------|
| Overdue rule (UTC month boundary, null guard) | 8 |
| Limit exceeded (null=unlimited, 0=always block, >0=block if exceeded) | 5 |
| Multiple rules (overdue takes precedence over limit) | 2 |
| Error handling (orders fail=blocked, profile fail=unlimited+logged) | 4 |
| Float precision (cent-level rounding) | 2 |
| Edge cases (empty orders, zero amounts) | 3 |

---

## Security Health Check — C2: Authorization & RLS

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| AUTHZ-001 | 🔴 CRITICAL | `markOrderSettledAction` and `bulkMarkOrdersSettledAction` missing `requireAdmin()` guard — any Server Action caller could mark orders as paid without admin auth | ✅ Fixed |
| AUTHZ-002 | 🟢 LOW | `create_order_atomic` correctly restricts EXECUTE to `service_role` only; SECURITY DEFINER + `SET search_path` prevent privilege injection | ✅ Verified |

### What Was Fixed

**AUTHZ-001 — Missing admin guards:**
- **Root cause:** Both settle-order actions were written without the `requireAdmin()` guard (which calls `getSession()` and redirects non-admins). While UI access is gated at the layout level, Server Actions should always have their own authorization check (defense-in-depth).
- **Fix:** Added `await requireAdmin()` as the first statement in both functions.
- **Test:** The `authorization.test.ts` dynamic check iterates all exported functions and verifies each calls `requireAdmin()` — this will catch any future regression automatically.

### What Was Verified

- Buyer sessions hard-code `isAdmin: false` regardless of JWT `app_role` claim — cannot be escalated by crafting a JWT with `app_role: "admin"`
- Admin sessions hard-code `isBuyer: false` — no role confusion
- Buyer cookie checked before Supabase Auth session — correct preference order
- `buyerLoginAction` rejects accounts with `role === "admin"` using the same generic error message as a missing account (no enumeration risk)

---

## Security Health Check — C4: Order State Machine

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| FIN-005 | 🟡 MEDIUM | `checkoutAction` has no idempotency key — network timeout + retry creates duplicate orders | Documented (backlog) |
| CSV-002 | 🟡 MEDIUM | `csvEsc` (in `admin.ts`) does not sanitise formula-injection prefixes (`=`, `+`, `-`, `@`) — admin CSV export could execute formulas in Excel | Documented (backlog) |

### What Was Verified

- `assignOrderAction` uses `.is("assigned_to", null)` — assignment is immutable once set
- `approveOrderAction` fetches current state before updating; guards: `pending→confirmed` (first approval) and `confirmed+credit_approved→confirmed+paid` (settlement); `confirmed_at` only set on first approval; `approvalType` validated against enum
- `cancelOrderAction` rejects non-pending orders; sets `cancelled_at` timestamp
- Dispatch email guarded by `if (isFirstApproval)` — not re-sent on credit settlement

---

## Security Health Check — C6: API Routes & PDF/Report

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| CSV-001 | 🟡 MEDIUM | `csvEsc` (in `daily-report.ts`) does not sanitise formula-injection prefixes — admin CSV download could execute formulas in Excel | Documented (backlog) |

### What Was Verified

- Invoice route (`/api/invoice/[orderId]`): `getSession()` → 401 if unauthenticated; order query scoped to `session.profileId` (IDOR protection); returns 404 not 403 (no oracle attack); no `isAdmin` bypass; `application/pdf` Content-Type
- Cron route (`/api/cron/daily-report`): exact-equality secret validation (`authHeader !== \`Bearer ${cronSecret}\``); `!authHeader || !cronSecret` guard covers unset env var; no `startsWith`/`includes` (no prefix-bypass)
- Daily report route (`/api/reports/daily`): `session?.isAdmin` required; date param validated with anchored regex `/^\d{4}-\d{2}-\d{2}$/`
- `daily-report.ts` has `import "server-only"` as first import; `dateStr` (DD/MM/YYYY from integer parts) is injection-safe

---

## Security Health Check — C7: Code Quality

### Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| QA-001 | 🟠 HIGH | 7 `console.log` statements in `adminLoginAction` logged admin email, Supabase user IDs, and profile role to server logs (added during live bug investigation) | ✅ Fixed — all debug logs removed |
| AUD-001 | 🟢 LOW | `audit_log` rows can be deleted by service-role — no immutability constraint | Documented (backlog) |
| QA-002 | 🟢 LOW | `(adminClient as any)` in `admin.ts` for audit_log insert — documented intentional workaround for Supabase type generator limitation | Documented |

---

## Outstanding Issues (Backlog)

| ID | Severity | Issue | Decision Needed |
|----|----------|-------|-----------------|
| SEC-003 | 🔴 CRITICAL | `SUPABASE_JWT_SECRET` shared between buyer JWT creation and Supabase DB — if leaked, anyone can forge buyer tokens | Architecture: separate buyer JWT secret from Supabase JWT secret |
| AUTH-002 | 🟠 HIGH | `secure` cookie only set in `NODE_ENV=production` — operator must verify TLS enforced at edge before launch | Deploy checklist: confirm TLS at load balancer |
| FIN-005 | 🟡 MEDIUM | No idempotency key on `checkoutAction` — rapid double-submit creates duplicate orders | Add client-generated nonce + server-side dedup |
| CSV-001/002 | 🟡 MEDIUM | `csvEsc` does not strip formula-injection prefixes (`=`, `+`, `-`, `@`) in both CSV exports | Add prefix sanitisation or warn admin in UI |
~~C5-02~~ | ~~🟡 MEDIUM~~ | ~~`credit_limit = 0` treated as unlimited~~ | ✅ Fixed 2026-03-27 |
| AUD-001 | 🟢 LOW | `audit_log` rows deletable by service-role — no append-only constraint | Add `FOR INSERT` only RLS policy on audit_log |

---

## Test Suite Summary

```
tests/audit/
├── setup.ts                                  # vi.mock stubs for Next.js runtime
├── security/
│   └── secret-boundary.test.ts               # 5 tests  — P1 complete
├── financial/
│   └── pricing.test.ts                       # 37 tests — P2 complete
├── email/
│   └── fulfillment-isolation.test.ts         # 9 tests  — P2 complete
├── inventory/
│   └── zombie-stock.test.ts                  # 9 tests  — P2 complete
├── auth/
│   ├── rate-limit.test.ts                    # 11 tests — C1 complete
│   ├── buyer-session.test.ts                 # 18 tests — C1 complete
│   └── account-number-validation.test.ts     # 22 tests — C1 complete
├── credit/
│   └── credit-status.test.ts                 # 24 tests — C5 complete
├── order/
│   └── state-machine.test.ts                 # 26 tests — C4 complete
├── api/
│   └── route-access.test.ts                  # 23 tests — C6 complete
└── quality/
    └── tech-debt.test.ts                     # 9 tests  — C7 complete
```

**Total tests: 237 passing**
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

*Last updated: 2026-03-27 — All chunks complete (P1, P2, C1, C2, C4, C5, C6, C7). 237 tests passing.*
