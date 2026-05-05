# Pre-Launch Checklist — AR Steel Manufacturing B2B Portal

**Date prepared:** 2026-05-05
**Prepared by:** Luke Petzer
**Branch:** `chore/prepare-launch-checklist-document`

This document consolidates every remaining action from `docs/audit/`, `docs/audit/12-open-questions.md`, and `docs/owner-information-request.md` into a single launch gate. Items are grouped by who must act. Nothing on this list was invented here — each item traces back to a specific finding, open question, or owner request already documented.

Mark each item `[x]` when done. Do not go live until every item in **Section 1** and **Section 2** is ticked, and every item in **Section 3** is signed off jointly.

---

## Section 1 — Developer Items

> Most code changes are complete. The items below are infrastructure, configuration, and content tasks that remain.

### 1.1 — Complete ✅

These branches are merged to `main` and confirmed working in production.

- [x] Security audit phases P1, P2, C1–C7 complete — 414 tests passing (multiple PRs)
- [x] FORCE RLS + `SET search_path` hardening applied to all 14 tables (PR #16, migration `20260504_02`)
- [x] Proforma invoice disclosure: "This document is not a tax invoice" footer added (PR #15, FINDING-161)
- [x] Credit check feature gated behind `CREDIT_CHECK_ENABLED = false` (PR #22)
- [x] Daily report emailed to `tenant_config.report_emails` recipients via Resend (PR #23)
- [x] Refund request persistence: DB-first, `refund_requests` table, admin workflow, buyer badges (PR #24)
- [x] Refund UX polish: "Return Requested" label, explicit "Request Return" button, order history auto-refresh (PR #25)

---

### 1.2 — Pending: Database

- [ ] **Apply migration `20260505_01` to production.**
  Run `supabase/migrations/20260505_01_create_refund_requests_table.sql` in the Supabase SQL Editor.
  Run pre-flight checks first, post-flight checks immediately after.
  See `docs/launch/pre-launch-checklist.md` §3.1 for the joint procedure.

- [ ] **Verify Phase 1 migrations applied to production.** (Q-DB-01)
  Run: `SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260414%';`
  Expected: 11 rows. If 0 rows returned, the schema was applied manually from `init.sql` rather than via CLI migrations — confirm actual table definitions and RLS policies match the hardened schema before proceeding.

- [ ] **Verify `src/proxy.ts` is loaded as Next.js middleware.** (Q-ARC-01)
  Next.js expects middleware at `src/middleware.ts` (or root `middleware.ts`). Confirm the non-standard filename works by checking Vercel function logs for middleware invocations on a protected route. If it is not being loaded, rename the file to `src/middleware.ts`. Until confirmed, layout-level `getSession()` redirects are the sole auth guard.

---

### 1.3 — Pending: Security

- [ ] **Split `BUYER_JWT_SECRET` from `SUPABASE_JWT_SECRET`.** (Q-SEC-01, SEC-003)
  `SUPABASE_JWT_SECRET` is currently used as both the Supabase project JWT signing key and the buyer custom JWT signing key. These must be separated before go-live.
  Steps:
  1. Generate a new random 256-bit secret: `openssl rand -base64 32`
  2. Add `BUYER_JWT_SECRET` to Vercel production environment variables.
  3. Update `src/lib/auth/buyer.ts` to sign and verify with `process.env.BUYER_JWT_SECRET` instead of `process.env.SUPABASE_JWT_SECRET`.
  4. Rotate `SUPABASE_JWT_SECRET` in the Supabase Dashboard → Settings → API after the code change is deployed (invalidates all existing buyer sessions — buyers will be re-prompted to log in).

- [ ] **Lock Supabase Auth redirect URL allowlist to production domain.** (Q-SEC-02)
  In Supabase Dashboard → Authentication → URL Configuration:
  1. Set **Site URL** to `https://portal.arsteelmanufacturing.co.za`
  2. Add `https://portal.arsteelmanufacturing.co.za/**` to **Redirect URLs**
  3. Remove any `localhost`, preview, or wildcard entries
  This prevents open-redirect phishing via the password reset flow.

---

### 1.4 — Pending: Vercel Configuration

- [ ] **Set `ADMIN_SUPER_EMAIL`** in Vercel → Production environment variables.
  This controls who can access `/admin/settings`. Must be set before first admin login.

- [ ] **Set `NEXT_PUBLIC_WHATSAPP_NUMBER`** (or leave blank to hide the button).
  Format: digits only, no `+` or spaces (e.g. `27721234567`).
  See `docs/launch/operational-config.md` for full instructions.
  Coordinate with client on which number to use.

- [ ] **Add explicit `maxDuration` to `vercel.json` for the PDF route.** (Q-PERF-03)
  The `/api/invoice/[orderId]` route is the heaviest endpoint. Set a specific timeout to guard against unexpected Vercel default changes.
  Add to `vercel.json`:
  ```json
  "functions": {
    "src/app/api/invoice/[orderId]/route.ts": { "maxDuration": 30 }
  }
  ```

---

### 1.5 — Pending: CI Pipeline

- [ ] **Set up GitHub Actions CI workflow.** (Q-TEST-01)
  No CI pipeline exists. Create `.github/workflows/ci.yml` running:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  on every PR and push to `main`. This is the primary regression guard for all 414 audit tests.

---

### 1.6 — Pending: Content (blocked on client supplying information)

These code changes cannot be made until the client supplies the required information (see Section 2.1).

- [ ] **Update CIPC registration number** — `src/app/page.tsx` line 253 (`CIPC Reg: [TO BE PROVIDED]`)
- [ ] **Update VAT number** — `src/app/page.tsx` line 254 (`VAT No: [TO BE PROVIDED]`)
- [ ] **Update Information Officer name** — `src/app/terms/page.tsx` line 153 (`[INFORMATION OFFICER FULL NAME]`)
- [ ] **Update delivery lead times** — `src/app/terms/page.tsx` lines 445, 449, 454 (three `[X] business days` placeholders)
- [ ] **Update `ESTIMATED_DELIVERY_RANGE`** — `src/lib/config/delivery.ts` line 11 (currently `"5–10 business days"`, imported by cart and order confirmation pages)

---

## Section 2 — Client Items

> Items the business owner (Rasheed / AR Steel Manufacturing) must action. The developer cannot complete these. Full context for each item is in `docs/owner-information-request.md`.

### 2.1 — Information required before developer can finish (blocks Section 1.6)

These four items are currently showing as placeholders in live production pages. They are visible to all visitors.

- [ ] **Full name of Information Officer** (POPIA requirement — goes in Privacy Policy §1)
  Default under POPIA: if no one is formally designated, the CEO/head of business is the Information Officer.
  → Unblocks: Section 1.6 terms update.

- [ ] **CIPC registration number** (format: YYYY/NNNNNN/NN — required on commercial SA websites)
  → Unblocks: Section 1.6 footer update.

- [ ] **VAT registration number** (10 digits, starts with 4 — required on all tax invoices and the website)
  → Unblocks: Section 1.6 footer update.

- [ ] **Delivery lead times** — rough estimates for:
  - In-stock items: how many business days to dispatch?
  - Custom/made-to-spec items: how many business days to dispatch?
  - Delivery transit: how many business days after dispatch?
  → Unblocks: Section 1.6 terms and delivery constant updates.

---

### 2.2 — Legal and compliance decisions (client must confirm)

- [ ] **Delivery area** — confirm the standard delivery area: Cape Town metro / Western Cape / national / by arrangement.
  Goes in: Delivery & Shipping Terms, Section 1.

- [ ] **Custom goods scope** — confirm whether any orders involve custom cuts, lengths, or specifications.
  Affects: cooling-off wording in Returns Policy (ECT Act s.44 exemption for custom goods).

- [ ] **Cancellation fee for custom orders** — confirm the policy when a custom order is cancelled mid-production.
  Current draft: "up to the full value of the order." Confirm or specify thresholds.

- [ ] **Credit terms clause review** — review Terms & Conditions Clause 3 ("Orders and Credit") for accuracy against actual business practice.
  Questions: standard payment terms? Interest on overdue? Portal suspension trigger?
  See `docs/owner-information-request.md` §8 for context.

---

### 2.3 — Legal compliance actions (client must complete, not developer)

- [ ] **Register Information Officer with the Information Regulator of South Africa.** (Q-POPIA-01)
  Required under POPIA s55. Free registration via the Information Regulator eServices portal at `www.justice.gov.za/inforeg/`.

- [ ] **Commission a PAIA Manual.** (Q-POPIA-02)
  Required for all private bodies in South Africa. Typically R2,000–R5,000 via a POPIA compliance service. Not a developer task.

- [ ] **Document a basic incident response plan.** (Q-POPIA-07)
  POPIA s22 requires breach notification to the Information Regulator as soon as reasonably possible (standard: 72 hours). The plan need not be elaborate — a one-page process covering: detect → contain → notify Regulator → notify affected buyers → log.

---

### 2.4 — Portal configuration (client does in admin UI or Vercel)

- [ ] **Set report email recipients.** Log in as Super Admin → `/admin/settings` → "Report Emails" field.
  Enter one or more comma-separated email addresses. These accounts will receive the daily orders CSV at 23:59 each night.
  See `docs/launch/operational-config.md` for full instructions.

- [ ] **Decide on WhatsApp contact button.** Provide the WhatsApp number (or confirm to leave the button hidden).
  Developer sets `NEXT_PUBLIC_WHATSAPP_NUMBER` in Vercel once number is supplied (see Section 1.4).

- [ ] **Create first admin user.** Follow `docs/Instructions/creating-admin-users.md` step-by-step.
  The Super Admin account must be created and tested before any buyers are invited.

---

## Section 3 — Joint Items

> Items requiring coordination between developer and client. Complete in order.

### 3.1 — Production database migrations

**Who:** Developer provides SQL; client/admin runs it in Supabase SQL Editor and confirms results.

- [ ] **Step 1 (developer):** Confirm exact migration file to run: `supabase/migrations/20260505_01_create_refund_requests_table.sql`

- [ ] **Step 2 (client/admin):** Run pre-flight queries in Supabase SQL Editor:
  ```sql
  -- Expected: 0 rows (table must not already exist)
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'refund_requests';

  -- Expected: 0 rows (sequence must not already exist)
  SELECT sequence_name FROM information_schema.sequences
  WHERE sequence_schema = 'public'
    AND sequence_name = 'refund_request_reference_seq';
  ```
  Report results to developer before proceeding.

- [ ] **Step 3 (client/admin):** Copy full migration SQL from the file above and run in Supabase SQL Editor.

- [ ] **Step 4 (client/admin):** Run post-flight verification:
  ```sql
  -- Expected: 14 rows
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'refund_requests'
  ORDER BY ordinal_position;

  -- Expected: relrowsecurity = true, relforcerowsecurity = true
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'refund_requests';

  -- Expected: 2 triggers
  SELECT trigger_name, action_timing
  FROM information_schema.triggers
  WHERE event_object_table = 'refund_requests'
  ORDER BY trigger_name;
  ```
  Share results with developer to confirm.

---

### 3.2 — End-to-end smoke test in production

**Who:** Developer and client together, against the production environment.

Follow `docs/qa-testing-plan.md` for the full step-by-step procedure. Minimum sign-off gates:

- [ ] Buyer registration → email verification → admin approval → first login
- [ ] Product catalogue loads with correct pricing for a test buyer
- [ ] Cart → checkout → EFT payment confirmation → proforma PDF downloads
- [ ] Admin order approval → buyer receives confirmation email → dispatch email sent
- [ ] Buyer submits a refund request → "Return Requested" badge appears in order history → admin sees it in `/admin/refund-requests` → acknowledge → resolve
- [ ] Daily report: verify it runs at 23:59 and email is received by the configured `report_emails` recipients (check the morning after go-live)
- [ ] Admin logs: confirm no unexpected errors in Vercel function logs for the first 24 hours

---

### 3.3 — Legal content sign-off

**Who:** Developer produces the text based on Section 2 answers; client reads and approves before go-live.

- [ ] Developer updates all four legal placeholders (see Section 1.6) once client supplies information
- [ ] Client reads the updated `/terms` page and confirms every clause accurately reflects actual business practice
- [ ] Client confirms the `/cookie-policy` and landing page footer are accurate
- [ ] Both parties confirm the email contact address throughout `/terms` — currently `orders@arsteelmanufacturing.co.za` — matches the production email inbox that someone monitors

---

## Reference Map

| Item | Source document | Section |
|------|-----------------|---------|
| FORCE RLS + search_path complete | `docs/audit/AUDIT-REPORT.md` | §C2 + Phase 2 hardening |
| JWT secret dual-use | `docs/audit/12-open-questions.md` | Q-SEC-01 |
| Redirect URL allowlist | `docs/audit/12-open-questions.md` | Q-SEC-02 |
| Middleware file name | `docs/audit/12-open-questions.md` | Q-ARC-01 |
| Phase 1 migrations in production | `docs/audit/12-open-questions.md` | Q-DB-01 |
| CI pipeline | `docs/audit/12-open-questions.md` | Q-TEST-01 |
| maxDuration for PDF route | `docs/audit/12-open-questions.md` | Q-PERF-03 |
| Information Officer name | `docs/owner-information-request.md` | §1 |
| CIPC number | `docs/owner-information-request.md` | §2 |
| VAT number | `docs/owner-information-request.md` | §3 |
| Delivery area | `docs/owner-information-request.md` | §4 |
| Lead times | `docs/owner-information-request.md` | §5 |
| Custom goods scope | `docs/owner-information-request.md` | §6 |
| Cancellation fee | `docs/owner-information-request.md` | §7 |
| Credit terms review | `docs/owner-information-request.md` | §8 |
| Information Regulator registration | `docs/owner-information-request.md` | §18 |
| PAIA Manual | `docs/owner-information-request.md` | §9 |
| Incident response plan | `docs/owner-information-request.md` | §17 |
| WhatsApp button | `docs/launch/operational-config.md` | §1 |
| Report emails | `docs/launch/operational-config.md` | §2 |
| Delivery constant | `docs/launch/operational-config.md` | §3 |
| ADMIN_SUPER_EMAIL | `docs/launch/operational-config.md` | §4 |
| Supabase redirect URL | `docs/launch/operational-config.md` | §5 |
| Creating admin users | `docs/Instructions/creating-admin-users.md` | — |
| Legal placeholders in UI | `docs/launch/codebase-inventory.md` | N-02 |
| Two email domains in UI | `docs/launch/codebase-inventory.md` | N-01 |

---

*End of checklist.*
