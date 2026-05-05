# Financial Correctness Audit — Credit / Statement Feature Gates

> Section 10 of the B2B Portal Audit Report.
> Created: 2026-05-04

---

## Context

Payments in this portal are managed **offline** — the client's ERP/external system records actual payment received, not this portal. Displaying outstanding balances or sending statement PDFs from the portal would show permanently inaccurate numbers.

Three feature flags gate the credit/statement-display surface:

| Flag | File | Value |
|---|---|---|
| `STATEMENT_PAGE_ENABLED` | `src/app/(portal)/dashboard/statement/page.tsx` | `false` |
| `STATEMENT_NAV_ENABLED` | `src/components/portal/NavBar.tsx` | `false` |
| `SEND_STATEMENT_ENABLED` | `src/components/admin/CreditDrawer.tsx` | `false` |
| `CREDIT_CHECK_ENABLED` | `src/lib/credit/checkCreditStatus.ts` | `false` |

---

## Findings

### FINDING-101 — Credit / Statement feature gates

| Field | Value |
|---|---|
| **ID** | FINDING-101 |
| **Severity** | N/A — feature gated off; sentinel test in place |
| **Status** | ✅ N/A — feature gated off; sentinel test in place |
| **Sentinel test** | `tests/audit/credit/credit-feature-gate.test.ts` (9 tests) |

**Description:**
The statement page, nav link, and send-statement button are all disabled via
`const FLAG = false` in their respective source files. This is intentional:
until payment tracking is implemented (payments recorded in the portal DB rather
than managed externally), showing outstanding balances would be inaccurate.

**Re-enabling requires all of the following:**
1. Payment tracking implemented — payments must be recorded in the portal DB so
   outstanding balances are accurate.
2. Business owner sign-off — a documented decision confirming the feature is
   ready for use.
3. The sentinel test updated (or removed) with a commit message explaining the
   decision. The test failure is the tripwire.

**Note on `CREDIT_CHECK_ENABLED`:**
`CREDIT_CHECK_ENABLED = false` is implemented in `src/lib/credit/checkCreditStatus.ts`.
When false, `checkCreditStatus()` returns `{ blocked: false, reason: null, outstanding: 0, creditLimit: null }`
immediately without any DB queries. Call sites:
- `src/app/actions/checkout.ts` — 30-day buyer checkout gate (currently never blocks)
- `src/app/(admin)/admin/page.tsx` — admin credit status display (currently shows no warnings)

**Status:** Deferred — feature gated off via `CREDIT_CHECK_ENABLED = false`.

**Re-enabling requires all of the following:**
1. A documented business decision.
2. FINDING-101 fail-open behaviour addressed: when the profiles table returns an error,
   `evaluateCreditStatus()` falls through to `creditLimit = null` (unlimited credit). This
   must be fixed to fail-closed before the flag is flipped to `true`.
3. The sentinel test in `tests/audit/credit/credit-feature-gate.test.ts` updated with a
   commit message explaining the decision.

The original credit logic is preserved in `evaluateCreditStatus()` (exported, fully unit-tested).
Flipping the flag is safe once the prerequisites above are met — no other code changes needed.

---

## Sentinel test coverage

`tests/audit/credit/credit-feature-gate.test.ts`

| Test | What it guards |
|---|---|
| `STATEMENT_PAGE_ENABLED` declared as `false` | Flag value has not been silently flipped |
| Redirect guard wired to flag | Flag is enforced, not just declared |
| `STATEMENT_NAV_ENABLED` declared as `false` | Flag value has not been silently flipped |
| Nav link gated by flag | Flag controls the link, not just declared |
| `SEND_STATEMENT_ENABLED` declared as `false` | Flag value has not been silently flipped |
| Send button gated by flag | Flag controls the UI, not just declared |

If any of these tests fail unexpectedly, a flag was changed without the prerequisites
above being met. **Do not simply update the expected value** — investigate whether
payment tracking is live before re-enabling.
