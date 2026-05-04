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
The audit open-questions doc (`docs/audit/12-open-questions.md`, Q12) references
a `CREDIT_CHECK_ENABLED = false` flag, but this flag **does not exist** in the
codebase. The `checkCreditStatus()` function runs live — it is called from:
- `src/app/actions/checkout.ts` (blocks 30-day buyer checkout if credit limit exceeded)
- `src/app/(admin)/admin/page.tsx` (surfaces credit status in the order ledger)

The three flags above are the actual implemented gates. FINDING-101 covers
these three flags only. The `CREDIT_CHECK_ENABLED` reference in the open-questions
doc is a documentation inconsistency and does not reflect real code.

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
