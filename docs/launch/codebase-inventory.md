# Codebase Inventory — Pre-Launch State

**Date:** 2026-05-05  
**Branch:** `docs/codebase-inventory`  
**Purpose:** Read-only snapshot of the application as it currently exists. No gap analysis. No proposed changes. Inventory only.  
**Platform:** Next.js 14 App Router, Supabase (Postgres + Auth), Resend (email), Vercel (hosting)  
**Intended audience:** Both B2B (trade buyers) and B2C (general public) customers.

---

## Table of Contents

1. [User-Facing Pages and Features](#section-1--user-facing-pages-and-features)
2. [Feature Flags and Gated Features](#section-2--feature-flags-and-gated-features)
3. [Communication and Contact Methods](#section-3--communication-and-contact-methods)
4. [Existing Legal and Policy Pages](#section-4--existing-legal-and-policy-pages)
5. [Order Lifecycle and Refund Handling](#section-5--order-lifecycle-and-refund-handling)
6. [Data Collection Inventory](#section-6--data-collection-inventory)
7. [Pricing Display and Product Information](#section-7--pricing-display-and-product-information)
8. [Hidden or Disabled Features](#section-8--hidden-or-disabled-features)
9. [Documentation Inventory](#section-9--documentation-inventory)
10. [Notes for Developer](#notes-for-developer)

---

## Section 1 — User-Facing Pages and Features

### 1.1 Authentication Routes

Route group: `(auth)`. Layout applies the styled auth-card UI. No session guard — publicly accessible.

| URL Path | File | Description | Auth Required |
|---|---|---|---|
| `/login` | `src/app/(auth)/login/page.tsx` | Buyer email + password sign-in form. Links to `/register` and `/forgot-password`. | None |
| `/register` | `src/app/(auth)/register/page.tsx` | New buyer account creation. Collects contact name, business name, email, password, and T&C consent checkbox. Sends email verification; new accounts land in an unapproved state pending admin approval. | None |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | Sends a password reset link via email. Returns generic success message regardless of whether the email exists. | None |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | New password entry form, reached via the reset link. Requires the Supabase session embedded in the reset link. | Implicit (Supabase reset link) |
| `/verify-success` | `src/app/(auth)/verify-success/page.tsx` | Static confirmation screen shown after email verification. Directs user to `/login`. | None |
| `/admin/login` | `src/app/(auth)/admin/login/page.tsx` | **Legacy stub.** Immediately redirects to `/login`. No separate admin login UI. | None |

---

### 1.2 Buyer Portal Routes

Route group: `(portal)`. The layout at `src/app/(portal)/layout.tsx` line 32 calls `getSession()` and issues `redirect("/login")` if the result is null. Every route in this group inherits this guard.

| URL Path | File | Description | Auth / Role | Notes |
|---|---|---|---|---|
| `/dashboard` | `src/app/(portal)/dashboard/page.tsx` | Product catalogue. Lists all active products with resolved pricing (custom price > discount % > base price). Supports search and category filtering. | Any authenticated buyer | Cached via `unstable_cache`, 60 s TTL |
| `/dashboard/statement` | `src/app/(portal)/dashboard/statement/page.tsx` | Account statement — lists outstanding unpaid/credit-approved orders for 30-day account clients. | `buyer_30_day` role | **Permanently inaccessible.** `STATEMENT_PAGE_ENABLED = false` (line 35) issues `redirect("/dashboard")` before any content renders. The full page UI is implemented below the redirect. |
| `/orders` | `src/app/(portal)/orders/page.tsx` | Order history table — all past orders with line items. Includes reorder capability. | Any authenticated buyer | |
| `/cart` | `src/app/(portal)/cart/page.tsx` | Cart review — items, quantities, shipping address selector, order notes. Supports `?reorder=<orderId>` pre-fill. Checkout is blocked if no shipping address is on file. | Any authenticated buyer | |
| `/checkout/payment` | `src/app/(portal)/checkout/payment/page.tsx` | EFT bank details + order summary. Buyer clicks "I have made payment" to confirm. `buyer_30_day` accounts are hard-redirected to `/dashboard` (line 24). | Any buyer **except** `buyer_30_day` | |
| `/checkout/confirmed` | `src/app/(portal)/checkout/confirmed/page.tsx` | Order confirmation — shows order reference, EFT banking details or 30-day account message. Proforma invoice PDF download available. Clears cart on mount. | Any authenticated buyer | PDF via `/api/invoice/[orderId]` |
| `/order-sheet` | `src/app/(portal)/order-sheet/page.tsx` | **Legacy stub.** Immediately redirects to `/dashboard`. No content. Not linked in nav. | Any authenticated buyer | |

---

### 1.3 Public Routes

No route group. Root layout. No session guard.

| URL Path | File | Description | Auth Required | Notes |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Public marketing landing page. Company overview, six department sections, CTA to login. | None | `'use client'`. Shows portal NavBar if logged in, PublicNavBar if not. |
| `/catalogue` | `src/app/catalogue/page.tsx` | Static PDF-style product catalogue rendered as 11 WebP image pages. | None | ISR revalidation every 86,400 s. No auth required. |
| `/terms` | `src/app/terms/page.tsx` | Full legal document: Terms & Conditions, Privacy Policy (POPIA), Returns Policy, and Delivery Terms — all as anchor-linked sections on a single page. | None | |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Cookie policy explaining session cookies. | None | |

---

### 1.4 Admin Routes

Route group: `(admin)`. Layout at `src/app/(admin)/layout.tsx` line 16 redirects to `/admin/login` (which then redirects to `/login`) if `!session?.isAdmin`.

| URL Path | File | Description | Auth / Role | Notes |
|---|---|---|---|---|
| `/admin` | `src/app/(admin)/admin/page.tsx` | Command Center — order ledger with KPI stats, filterable order table, credit status for 30-day pending orders. | `isAdmin = true` | Employees see only unassigned or their own orders; managers see all. |
| `/admin/dashboard` | `src/app/(admin)/admin/dashboard/page.tsx` | **Legacy stub.** Renders "Phase 5 — Full admin dashboard coming soon." and a sign-out button only. | `isAdmin = true` | Not linked from admin sidebar. Accessible by URL only. |
| `/admin/clients` | `src/app/(admin)/admin/clients/page.tsx` | Client profile management — all `buyer_default` and `buyer_30_day` accounts. Opens `ClientDrawer` (defaults) or `CreditDrawer` (30-day). Shows unpaid totals for credit clients. | `isAdmin = true` | |
| `/admin/products` | `src/app/(admin)/admin/products/page.tsx` | Product catalogue management — list, pricing, images, stock, discounts. Opens `ProductDrawer`. | `isAdmin = true` | |
| `/admin/notifications` | `src/app/(admin)/admin/notifications/page.tsx` | Global portal-wide announcement banner — toggle and set. | `isAdmin = true` | |
| `/admin/settings` | `src/app/(admin)/admin/settings/page.tsx` | Tenant config (business name, banking details, email settings) + admin user management. | `isSuperAdmin = true` | Double-gated: requires `isAdmin` (layout) AND `isSuperAdmin` (page line 13). `isSuperAdmin` is determined by the `ADMIN_SUPER_EMAIL` env var. |
| `/admin/audit` | `src/app/(admin)/admin/audit/page.tsx` | Immutable audit log — paginated table of all INSERT/UPDATE/DELETE events on audited tables. | `isAdmin = true` | Visible to all admin roles; not restricted to managers. |

---

### 1.5 API Routes

| URL Path | File | Description | Auth |
|---|---|---|---|
| `/auth/callback` | `src/app/auth/callback/route.ts` | Supabase PKCE code exchange. Redirects to `?next=` param or `/dashboard`. | None (handles its own token exchange) |
| `/api/auth/nav-state` | `src/app/api/auth/nav-state/route.ts` | Returns `{ isAuthenticated, role, businessName }`. Used by client-side nav components. | Session (returns anonymous state if none) |
| `/api/invoice/[orderId]` | `src/app/api/invoice/[orderId]/route.ts` | Generates and streams proforma invoice PDF. Validates session + order ownership. Rate-limited. | Session + order ownership |
| `/api/reports/daily` | `src/app/api/reports/daily/route.ts` | Streams daily orders CSV download. Available to managers via button on `/admin`. | `isAdmin` + manager role |
| `/api/cron/daily-report` | `src/app/api/cron/daily-report/route.ts` | Cron-triggered daily report upload to Supabase Storage. Fires at 23:59 via `vercel.json`. | Vercel cron secret |

---

## Section 2 — Feature Flags and Gated Features

### Named Boolean Constants

| Flag Name | Current Value | File | Line(s) | Feature Controlled | UI State |
|---|---|---|---|---|---|
| `STATEMENT_PAGE_ENABLED` | `false` | `src/app/(portal)/dashboard/statement/page.tsx` | 35, 38 | The `/dashboard/statement` route. When `false`, the page immediately calls `redirect("/dashboard")`. | Fully inaccessible — hard redirect |
| `STATEMENT_NAV_ENABLED` | `false` | `src/components/portal/NavBar.tsx` | 26, 31 | The "Statement" nav link for `buyer_30_day` users. When `false`, the link is absent from `NAV_LINKS` entirely. | Fully hidden from nav |
| `SEND_STATEMENT_ENABLED` | `false` | `src/components/admin/CreditDrawer.tsx` | 5, 317 | The "Send Statement" button inside the admin Credit Drawer. The button is conditionally excluded: `{SEND_STATEMENT_ENABLED && ...}`. The underlying `sendClientStatementAction` server action and `ClientStatement` email template still exist. | Fully removed from admin UI |

All three flags carry the same comment: "disabled until payment tracking is implemented. Payments are currently managed offline."

### Environment Variable Toggles

| Env Var | Default Value (`.env.example`) | File | Line | Feature Controlled | UI State |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `""` (blank) | `src/app/(portal)/layout.tsx` | 51–53 | Floating WhatsApp contact button (bottom-right of every portal page). Rendered only when `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER` is truthy. | Hidden when blank; visible when set |

### Role-Based Workflow Branching (not a named flag)

Not an explicit toggle, but the payment workflow forks on role:

- `buyer_default` → EFT flow: checkout redirects to `/checkout/payment?orderId=...` (`src/app/actions/checkout.ts` line 360)
- `buyer_30_day` → Credit flow: checkout redirects directly to `/checkout/confirmed?orderId=...`; the `/checkout/payment` page additionally hard-redirects these users back to `/dashboard` (`src/app/(portal)/checkout/payment/page.tsx` line 24)

### `CREDIT_CHECK_*` Flag

**Not found.** No constant or variable named `CREDIT_CHECK_*` exists anywhere in the codebase. The credit-checking logic in `src/lib/credit/checkCreditStatus.ts` is always-on and called unconditionally from the admin Command Center for all `buyer_30_day` pending orders. There is no flag to disable or bypass it.

---

## Section 3 — Communication and Contact Methods

### 3.1 Contact Form Pages

**No dedicated contact form page exists.** There is no route with a subject/message field directed to the business. The only structured "contact the business" mechanism available to authenticated buyers is the Return Request Modal (see §5.3).

Error messages in checkout (`src/app/actions/checkout.ts` lines 276, 371) contain the text "Please contact support" and "Please contact your account manager" — but these are toast messages, not links or forms.

### 3.2 Phone Numbers

One phone number appears in the application, in two locations:

| Number | File | Line | Rendering |
|---|---|---|---|
| `021 271 0526` | `src/app/page.tsx` | 336 | Plain text `<span>` in landing page footer — not a `tel:` link |
| `021 271 0526` | `src/app/terms/page.tsx` | 510 | Inline in the delivery section — not a `tel:` link |

Admin form placeholders (`src/components/admin/SettingsForm.tsx` line 260, `src/components/admin/ClientDrawer.tsx` line 298) use `+27 11 000 0000` as placeholder text only — not real numbers.

### 3.3 Email Addresses Displayed in UI

Two different email domains appear in the application:

| Email Address | Domain | File | Lines | Context |
|---|---|---|---|---|
| `info@armanufacturing.co.za` | `armanufacturing.co.za` | `src/app/page.tsx` | 340 | Landing page footer, mail icon row |
| `info@armanufacturing.co.za` | `armanufacturing.co.za` | `src/app/cookie-policy/page.tsx` | 125, 128 | Cookie Policy contact section — rendered as `mailto:` link |
| `orders@arsteelmanufacturing.co.za` | `arsteelmanufacturing.co.za` | `src/app/terms/page.tsx` | 73, 76, 156, 159, 265, 268, 363, 366, 386, 389, 412, 415, 505, 508 | Eight separate contact blocks throughout the Terms page |

**Two different domains are in use.** `armanufacturing.co.za` appears on the public-facing landing and cookie pages; `arsteelmanufacturing.co.za` appears throughout the legal document.

### 3.4 WhatsApp / Messaging Integrations

**WhatsApp floating button — present in authenticated portal:**

- Component: `src/components/portal/WhatsAppButton.tsx` (30 lines)
  - Fixed position: `bottom-6 right-6`
  - Builds link as `https://wa.me/${digits}` (strips non-numeric chars from env var)
  - `aria-label="Contact us on WhatsApp"`
- Mounted in: `src/app/(portal)/layout.tsx` lines 50–53
- Guard: `{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (...)}`  — button is absent when env var is blank or unset
- No hardcoded phone number in source code

No other chat widgets found (Tawk, Intercom, Crisp, Freshchat, Zendesk, LiveChat).

### 3.5 Internal Help / Report-a-Problem Mechanisms

- **Return/Refund request form** (see §5.3) — the only structured mechanism for authenticated buyers to report a problem
- No help button, ticket system, feedback form, or dedicated support page

### 3.6 Email Templates

All templates are in `src/emails/`, use `@react-email/components`, and are sent via Resend.

| Template File | Purpose | Triggered By | Recipients | PDF Attached? |
|---|---|---|---|---|
| `BuyerReceipt.tsx` | Order acknowledgment to buyer | Checkout submission (`src/app/actions/checkout.ts` line 132) | Buyer (registered email) | No |
| `SupplierInvoice.tsx` | Internal new-order notification to warehouse/accounts team | Checkout submission (`src/app/actions/checkout.ts` line 103) | `tenant_config.email_from_address` | Yes — PDF invoice |
| `OrderApprovedNotification.tsx` | Order approved / dispatched notification to buyer | Admin approves order (`src/app/actions/admin.ts` line 349) | Buyer | No |
| `DispatchNotification.tsx` | Dispatch sheet to warehouse team | Admin approves order (`src/app/actions/admin.ts` line 269) | `dispatch_email` from tenant config | Yes — dispatch sheet PDF |
| `RefundRequest.tsx` | Two-in-one: buyer confirmation + business notification of return request | `submitRefundRequestAction` (`src/app/actions/refund.ts` line 32) | Buyer (confirmation) + supplier (notification) | No |
| `ClientStatement.tsx` | Outstanding orders statement for 30-day credit clients | Admin manually triggers via `CreditDrawer` or `OrderLedger` (`src/app/actions/admin.ts` line 1327) | Credit client (buyer) | No |

All six templates contain real production content. No lorem ipsum. All include a `supplierName` prop for multi-tenant use. `supportEmail` appears as a footer detail in `BuyerReceipt`, `OrderApprovedNotification`, and `ClientStatement` (shown only when non-null).

**There is no email sent on order cancellation.**

---

## Section 4 — Existing Legal and Policy Pages

### 4.1 Terms and Conditions

**Found. Route: `/terms`**

- File: `src/app/terms/page.tsx`
- Word count: approximately 2,357 words of prose
- Content: Real, substantive content. Effective date: 1 April 2025. Jurisdiction: Republic of South Africa.
- Unfilled placeholder: Line 153 contains `[INFORMATION OFFICER FULL NAME]` — the POPIA-required named Information Officer has not been filled in.

The page is a single combined document with four anchor-linked sections:

| Anchor | Title | Covers |
|---|---|---|
| `#terms` | Terms and Conditions | Eligibility, Account Registration, Orders & Credit, Pricing & VAT, IP, Dispute Resolution |
| `#privacy` | Privacy Policy (POPIA) | Information Officer (unfilled), Data Collected, Purpose, Legal Basis, Third-Party Processors (Vercel, Supabase, Resend), Retention, Rights, Cookies cross-ref |
| `#returns` | Returns, Refunds & Cancellations Policy | Cooling-Off (ECT Act s.44), Defective Goods (CPA s.56), Cancellations, Refund Timelines, Contact |
| `#delivery` | Delivery & Shipping Terms | Lead Times (contains `[X]` placeholders), Delivery Method, Risk Transfer, Inspection, Contact |

Links to this page from:

| Linking file | Target(s) |
|---|---|
| `src/app/page.tsx` (landing page footer) | `/terms`, `/terms#privacy`, `/terms#returns`, `/terms#delivery` |
| `src/app/(portal)/layout.tsx` (portal utility footer) | `/terms`, `/terms#privacy`, `/terms#returns`, `/terms#delivery` |
| `src/app/(auth)/register/page.tsx` | `/terms`, `/terms#privacy` (consent checkbox) |

### 4.2 Privacy Policy

**Not a standalone page.** Embedded as the `#privacy` anchor section within `/terms` (lines 140–292 of `src/app/terms/page.tsx`). See §4.1. Contains POPIA citations, lists three sub-processors, and includes retention and rights clauses.

### 4.3 Refund / Returns Policy

**Not a standalone page.** Embedded as the `#returns` anchor section within `/terms` (lines 296–420 of `src/app/terms/page.tsx`). Covers the ECT Act cooling-off period and CPA Section 56 defective goods rights.

### 4.4 Delivery / Shipping Policy

**Not a standalone page.** Embedded as the `#delivery` anchor section within `/terms` (lines ~430–513 of `src/app/terms/page.tsx`). Contains three unfilled `[X] business days` placeholders for dispatch and transit times.

### 4.5 Cookie Policy

**Found. Route: `/cookie-policy`**

- File: `src/app/cookie-policy/page.tsx`
- Word count: approximately 417 words
- Content: Real content. Effective date: 1 April 2025. Contains a table of specific cookies (`sb-buyer-session`, `sb-*`, `cookie-consent-v1`) with category, purpose, and duration. References POPIA compliance.
- Contact: `info@armanufacturing.co.za` as Information Officer contact (lines 125, 128)

Linked from: `src/app/page.tsx` (landing footer), `src/app/terms/page.tsx` (privacy cross-reference), `src/components/consent/CookieBanner.tsx` (cookie consent banner).

### 4.6 POPIA / Data Protection Notice

**Not a standalone page.** Covered within the `#privacy` section of `/terms`. POPIA (Protection of Personal Information Act 4 of 2013) is cited throughout.

### 4.7 Acceptable Use Policy

**Nothing found.** No AUP page, route, or reference anywhere in the codebase.

### 4.8 Static Legal Documents in `/public/`

**Nothing found.** No static PDF or HTML legal documents in the public directory.

---

## Section 5 — Order Lifecycle and Refund Handling

### 5.1 Order Status Values

Defined as a Postgres ENUM (`public.order_status`) and TypeScript union at `src/lib/supabase/types.ts` lines 6–11 and `supabase/init.sql` lines 67–73.

| Status | Meaning |
|---|---|
| `pending` | Order placed; awaiting admin action |
| `confirmed` | Admin has approved (EFT verified or credit approved) |
| `processing` | In the DB enum and TypeScript types but no application code transitions to this state |
| `fulfilled` | Goods dispatched; in the DB enum but no application code transitions to this state |
| `cancelled` | Cancelled by admin from `pending` only |

A separate `OrderPaymentStatus` (`src/lib/supabase/types.ts` line 18) tracks payment state independently: `unpaid`, `paid`, `credit_approved`.

### 5.2 Status Transitions

All transitions are admin-initiated. There are no webhooks, cron jobs, or database triggers that automatically advance order status. Checkout always inserts with `status = 'pending'` via the `create_order_atomic` Postgres function (`src/app/actions/checkout.ts` line 361–362).

| Transition | Trigger | File | Lines |
|---|---|---|---|
| `pending` → `confirmed` | Admin clicks Approve. Sets `status = 'confirmed'`, `payment_status = 'paid'` or `'credit_approved'`, `confirmed_at = now()`. | `src/app/actions/admin.ts` | 416–456 |
| `credit_approved` payment → `paid` | Admin settles credit account. Updates `payment_status` only; order `status` stays `confirmed`. | `src/app/actions/admin.ts` | 417–432 |
| `pending` → `cancelled` | Admin cancels. Restricted to `pending` orders. Sets `status = 'cancelled'`, `cancelled_at = now()`. | `src/app/actions/admin.ts` | 468–508 |

An immutable status history trigger (`trg_orders_status_history`, `supabase/init.sql` lines 690–712) fires `AFTER INSERT OR UPDATE ON public.orders` and appends a row to `order_status_history` with `from_status`, `to_status`, and `changed_by`. This table is never queried from the application layer.

### 5.3 User-Initiated Cancellation or Refund

**Cancellation:** No buyer-facing cancel mechanism. Cancellation is admin-only.

**Refund/Return request:** A `RefundRequestModal` component (`src/components/portal/RefundRequestModal.tsx`) is mounted on every row of the order history table (`src/components/portal/OrderHistoryTable.tsx` lines 191, 243). It is a three-field form:

| Field | Type | Required |
|---|---|---|
| Reason for return | Select (`defective_damaged`, `incorrect_items`, `not_as_described`, `other`) | Yes |
| Date goods received | Date input | Yes |
| Additional details | Textarea (max 1,000 chars) | No |

Submission calls `submitRefundRequestAction` (`src/app/actions/refund.ts`). This action does **not** change order status and does **not** write any database row. It sends two emails (buyer confirmation, supplier notification) and returns `{ success: true }`.

**Cooling-off disclosure:** A `CoolingOffModal` component (`src/components/portal/CoolingOffModal.tsx`) is shown on the EFT payment page. It discloses the 5-business-day cooling-off right under ECT Act Section 44 but provides no form or action — it links to `/terms#returns`.

### 5.4 Admin-Side Refund Processing

**Nothing found.** The admin UI has no refund workflow, no refund approval button, and no way to mark an order as refunded. Admin can cancel a `pending` order and can update payment status, but there is no explicit refund state or screen. Refund handling is entirely off-platform: the business receives an email and contacts the buyer directly.

### 5.5 What Happens to Order Data When Cancelled

Orders are **soft-status-changed only**. `cancelOrderAction` (`src/app/actions/admin.ts` lines 493–508) issues an `UPDATE` setting `status = 'cancelled'` and `cancelled_at = now()`. The order row, all `order_items` rows, any `payments` rows, and the `order_status_history` trigger entry are all preserved. There is no hard-delete path.

### 5.6 Email Notifications on Status Change

| Event | Template Used | Recipients |
|---|---|---|
| Order placed (checkout) | `SupplierInvoice` + `BuyerReceipt` | Supplier email + buyer email |
| Order approved | `OrderApprovedNotification` + `DispatchNotification` | Buyer + dispatch/warehouse email |
| Return request submitted | `RefundRequest` (buyer + supplier variants) | Buyer + `SUPPLIER_EMAIL` env var |
| Client account statement | `ClientStatement` | Buyer (admin-triggered manually) |
| **Order cancelled** | **No email sent** | — |

---

## Section 6 — Data Collection Inventory

### 6.1 Registration / Signup Form

**File:** `src/app/(auth)/register/page.tsx`  
**Validation:** Zod schema at line 16 + server-side `signUpSchema` in `src/app/actions/auth.ts` lines 25–29

| Field | Required | Stored | Table / Column |
|---|---|---|---|
| `contact_name` | Yes (min 1, max 120 chars) | Yes | `profiles.contact_name` |
| `business_name` | No (optional, max 120 chars) | Yes | `profiles.business_name` |
| `email` | Yes (valid email, max 254 chars) | Yes | `auth.users.email` + `profiles.email` |
| `password` | Yes (min 8, max 128 chars) | Hashed by Supabase Auth | `auth.users` (hashed) — not stored by application |
| Terms checkbox | Yes — `z.literal(true)` | **No** — not persisted to DB | n/a |

Consent: A checkbox linking to `/terms` and `/terms#privacy` must be ticked to submit. The consent boolean itself is not stored anywhere.

### 6.2 Login Form

**File:** `src/app/(auth)/login/page.tsx`

| Field | Required | Stored |
|---|---|---|
| `email` | Yes | Not stored — passed to Supabase Auth |
| `password` | Yes | Not stored — passed to Supabase Auth |

No consent collection.

### 6.3 Checkout / Order Placement

**Files:** `src/app/(portal)/cart/CartReviewShell.tsx`, `src/app/actions/checkout.ts`

| Field | Required | Stored | Table / Column |
|---|---|---|---|
| Cart items (productId, sku, name, quantity) | Yes (non-empty cart) | Yes — snapshotted at order time | `order_items` |
| `order_notes` | No (max 1,000 chars) | Yes | `orders.order_notes` |
| Delivery address (`addressId`) | Yes — checkout blocked without one | Yes — stored as JSONB snapshot | `orders.shipping_address` |
| `buyer_reference` / PO number | No (max 100 chars, on payment page) | Yes | `orders.buyer_reference` |

No consent collection at checkout.

### 6.4 Delivery Address Form

**Files:** `src/components/auth/AddressGateForm.tsx`, `src/app/actions/addresses.ts`  
**Validation:** `addressSchema` (`src/app/actions/addresses.ts` lines 8–17)

| Field | Required | Stored | Table / Column |
|---|---|---|---|
| `label` | No (max 100 chars) | Yes | `addresses.label` |
| `line1` | Yes (min 1, max 200 chars) | Yes | `addresses.line1` |
| `line2` | No (max 200 chars) | Yes | `addresses.line2` |
| `suburb` | No (max 100 chars) | Yes | `addresses.suburb` |
| `city` | Yes (min 1, max 100 chars) | Yes | `addresses.city` |
| `province` | No (max 100 chars) | Yes | `addresses.province` |
| `postal_code` | No (max 20 chars) | Yes | `addresses.postal_code` |
| `country` | No (defaults to "South Africa") | Yes | `addresses.country` |

No consent collection. Address type is always `shipping`, `is_default: true` (hardcoded, `src/app/actions/addresses.ts` line 46).

### 6.5 Buyer Profile / Account Settings Form

**Nothing found.** No buyer-facing profile edit page exists. Buyers cannot update their own contact name, business name, or email through the portal. Admins can edit buyer profiles via `/admin/clients/` (`updateClientAction` in `src/app/actions/admin.ts`).

### 6.6 Admin Invite Client Form

**File:** `/admin/clients/` — `inviteClientAction` in `src/app/actions/admin.ts` lines 1029–1067

| Field | Required | Stored | Table / Column |
|---|---|---|---|
| `email` | Yes (valid email, max 254 chars) | Yes (via Supabase Auth invite) | `auth.users.email` |
| `contact_name` | Yes (max 120 chars) | Yes | `profiles.contact_name` |
| `business_name` | No (max 120 chars) | Yes | `profiles.business_name` |

No consent collection — admin-initiated invites, not self-registration.

### 6.7 Refund Request Form

**File:** `src/components/portal/RefundRequestModal.tsx`

| Field | Required | Stored | Table / Column |
|---|---|---|---|
| `orderId` (hidden) | Yes | Not stored separately | Used only for order lookup in email |
| `reason` (select) | Yes | **No** — sent by email only | n/a |
| `dateReceived` (date) | Yes | **No** — sent by email only | n/a |
| `details` (textarea, max 1,000 chars) | No | **No** — sent by email only | n/a |

No refund data is persisted to the database. No consent checkbox.

### 6.8 Contact / Inquiry Forms

**Nothing found.** No standalone contact form exists.

### 6.9 Personal Data in the Database

Key tables that hold personal data (from `supabase/init.sql` and migrations):

| Table | Personal Data Columns |
|---|---|
| `auth.users` (Supabase-managed) | email, hashed password, email_confirmed_at |
| `profiles` | business_name, contact_name, email, phone, mobile, fax, vat_number, notes |
| `addresses` | line1–2, suburb, city, province, postal_code, country |
| `orders` | order_notes, buyer_reference, shipping_address (JSONB snapshot), delivery_instructions |
| `order_items` | product_name, sku, pricing (snapshotted) |
| `payments` | amount, proof_url, reference |
| `buyer_sessions` | user_agent, **ip_address** |
| `audit_log` | old_data / new_data JSONB — may contain personal data from any audited table |
| `order_status_history` | from_status, to_status, changed_by (auth.uid()) |

---

## Section 7 — Pricing Display and Product Information

### 7.1 VAT Display

Prices throughout the portal are displayed **VAT-exclusive**, with a separate VAT line item calculated at **15%**.

| Surface | What is shown | File | Lines |
|---|---|---|---|
| Product listing (`ProductRow.tsx`) | Raw price only — no "excl. VAT" annotation on the row itself | `src/components/portal/ProductRow.tsx` | 127 |
| Cart sidebar (`CartSidebar.tsx`) | "Subtotal (Excl. VAT)" + "VAT (15%)" line | `src/components/portal/CartSidebar.tsx` | 14, 105, 109 |
| Cart review page (`CartReviewShell.tsx`) | "Subtotal (Excl. VAT)", "VAT (15%)", footer note "VAT is calculated at 15% and confirmed at checkout." | `src/app/(portal)/cart/CartReviewShell.tsx` | 18, 209, 231, 292 |
| Checkout payment page | Fetches `vat_amount` from DB, renders as named "VAT" line | `src/app/(portal)/checkout/payment/page.tsx` | 34, 134–136 |
| Order history (`OrderHistoryTable.tsx`) | "Subtotal (Excl. VAT)" + "VAT (15%)" in expanded breakdown | `src/components/portal/OrderHistoryTable.tsx` | 300–309 |
| Terms page | "All prices displayed are exclusive of Value-Added Tax (VAT)…" | `src/app/terms/page.tsx` | 94–97 |

The VAT rate is **hardcoded at 15%** in `CartSidebar.tsx` and `CartReviewShell.tsx`. The `tenant_config` table has a `vat_rate` column (defaulting to 0.15) that the invoice PDF uses, but buyer-facing cart components ignore it.

### 7.2 Stock Availability

**Stock is not shown to buyers.** The `track_stock` and `stock_qty` columns exist on the `products` table and are readable in the admin product page and `ProductDrawer`, but:

- Neither field is fetched in the buyer-facing catalogue query (`src/app/(portal)/dashboard/page.tsx` line 26)
- `ProductRow.tsx` has no stock display logic
- `ProductDrawer.tsx` includes `<input type="hidden" name="track_stock" value="false" />` (line 204) — the track-stock feature is intentionally disabled in the product form

### 7.3 Estimated Delivery Time

**No delivery time or ETA is shown to buyers in the portal UI.** The delivery terms linked from the portal footer and landing page (`/terms#delivery`) contain unfilled `[X] business days` placeholders:

- `src/app/terms/page.tsx` lines 445, 449–450, 454 — three occurrences of `[X]`

### 7.4 SKU / Product Information Completeness

SKU numbers are prominently displayed across the buyer portal:

| Surface | File | Line |
|---|---|---|
| Product listing (col 2) | `src/components/portal/ProductRow.tsx` | 108 |
| Cart review (compact and expanded views) | `src/app/(portal)/cart/CartReviewShell.tsx` | 99, 127, 164 |
| Order history (expanded line-items) | `src/components/portal/OrderHistoryTable.tsx` | 270 |
| Search bar label ("Search by SKU or product name…") | `src/app/(portal)/dashboard/CatalogueShell.tsx` | 131 |

**Unfilled placeholders in public-facing content:**

| Placeholder | File | Lines |
|---|---|---|
| `CIPC Reg: [TO BE PROVIDED]` | `src/app/page.tsx` | 253 |
| `VAT No: [TO BE PROVIDED]` | `src/app/page.tsx` | 254 |
| `[X] business days` (× 3, dispatch and transit windows) | `src/app/terms/page.tsx` | 445, 449, 454 |

### 7.5 B2B Custom Pricing

A full custom pricing system is implemented and connected end-to-end:

- **Per-product custom prices:** `client_custom_prices` table, one row per `(profile_id, product_id)` pair
- **Client-level discount percentage:** `profiles.client_discount_pct` column
- **Resolution priority:** custom price → client discount % → base price, implemented in `src/lib/pricing/resolveClientPricing.ts`
- **Applied at catalogue load:** `src/app/(portal)/dashboard/page.tsx` lines 99–124
- **Re-validated at checkout (server-side):** `src/app/actions/checkout.ts` lines 300–314 — cannot be spoofed
- **Admin UI:** `ClientDrawer.tsx` allows admin to set per-product override prices and a blanket discount % per client

**There is no buyer-visible "your price" vs "list price" distinction.** Buyers see only their resolved price with no indication that it differs from the standard rate.

---

## Section 8 — Hidden or Disabled Features

### 8.1 Components Defined But Not Imported Anywhere

**`src/components/CoolingOffNotice.tsx`** — A standalone component rendering the cooling-off rights disclosure as a notice box. Never imported anywhere in the codebase. Functionally equivalent UI exists inside `CoolingOffModal.tsx` and inline in `CartReviewShell.tsx`. Appears to be a superseded version not cleaned up.

**`src/components/demo/SteelMatrixRow.tsx`** — A 200-line interactive component for ordering Equal Angle Grade Mild Steel via dimension/thickness/length dropdowns, with real-time weight and price calculation. Never imported anywhere. Uses hardcoded `pricePerKg: 18.5` (lines 10–18) and a placeholder Unsplash image URL (line 118). This is a prototype for a per-kg/per-metre pricing model that was built but never integrated into the portal.

### 8.2 Routes That Exist But Are Not Linked From Any Nav

| Route | File | Status |
|---|---|---|
| `/admin/dashboard` | `src/app/(admin)/admin/dashboard/page.tsx` | Not in `AdminSidebar.tsx`. Renders "Phase 5 — Full admin dashboard coming soon." Accessible by direct URL only. |
| `/order-sheet` | `src/app/(portal)/order-sheet/page.tsx` | Not in `NavBar.tsx`. Immediately redirects to `/dashboard`. Legacy URL alias. |
| `/dashboard/statement` | `src/app/(portal)/dashboard/statement/page.tsx` | Hidden by `STATEMENT_NAV_ENABLED = false` and additionally blocked by `STATEMENT_PAGE_ENABLED = false`. Full page UI is implemented but unreachable. |

### 8.3 API Endpoints Defined But Never Called From UI

**No orphaned API endpoints found.** All four API routes are called:

| Endpoint | Caller |
|---|---|
| `/api/auth/nav-state` | `CatalogueNavBar.tsx` line 18 |
| `/api/invoice/[orderId]` | `src/app/(portal)/checkout/confirmed/page.tsx` line 183 |
| `/api/reports/daily` | `src/app/(admin)/admin/page.tsx` line 262 (manager-only download button) |
| `/api/cron/daily-report` | `vercel.json` cron at `59 23 * * *` |

### 8.4 Email Templates That Exist But May Never Be Triggered

**No dead email templates found.** All six templates are triggered (see §3.6). `ClientStatement` is conditionally triggered for `buyer_30_day` clients only, from `CreditDrawer.tsx` and `OrderLedger.tsx`, but the trigger path is live code (not gated by a feature flag at the call site — the `SEND_STATEMENT_ENABLED` flag gates the UI button, but the server action itself is reachable).

### 8.5 Database Tables: Read/Write Asymmetries

| Table | Reads | Writes | Notes |
|---|---|---|---|
| `payments` | Only a dedup existence check at `src/app/actions/checkout.ts` line 529 | `INSERT` at `src/app/actions/checkout.ts` line 549 | **Never displayed in admin UI.** Admin has no way to view EFT payment submissions through any current page. Payment management is documented as "Phase 5." |
| `order_status_history` | Never queried from any `.ts`/`.tsx` | Written by `trg_orders_status_history` DB trigger on every order INSERT/UPDATE | Immutable history is accumulating but no UI exposes it to admin or buyer. |
| `buyer_sessions` | Only referenced in `src/lib/supabase/types.ts` type definition | Only referenced in `src/lib/supabase/types.ts` type definition | **Zero application code references.** No INSERT, no SELECT in any action or page. Appears to be schema for a session-revocation system that was never wired up. |
| `tenant_config.report_emails` | Never read in any application code | Written by `saveSettingsAction` (settings form) | Column exists and persists through the settings UI, but the cron job does not use it. The migration comment reads "wired up later." |

---

## Section 9 — Documentation Inventory

`docs/launch/` did not exist prior to this commit. Created as part of this inventory.

### `docs/audit/`

| File | Description | Lines | Status |
|---|---|---|---|
| `docs/audit/AUDIT-REPORT.md` | Living master audit report — tracks all findings (P1–P2 and C1–C7) by finding ID, severity, and fix status; 237 tests passing | 300 | Complete |
| `docs/audit/10-financial-correctness-audit.md` | Section 10: documents the three statement/credit feature flags and the sentinel test enforcing them (FINDING-101) | 75 | Complete |
| `docs/audit/12-open-questions.md` | Open questions raised during audit (Q-SEC-01 onwards) requiring owner/infra answers before production — some still open | 296 | In-progress |
| `docs/audit/SQL-Results.md` | Raw results from audit SQL queries run in Supabase SQL Editor (FORCE RLS status, search_path, migration versions) | 413 | In-progress |
| `docs/audit/agent-fix-template.md` | Standard TDD workflow template for all audit remediation branches | 120 | Complete |
| `docs/audit/follow-ups.md` | Non-blocking follow-up items from pre-flight branch: 6 ESLint warnings with exact file/line/fix | 39 | Complete |
| `docs/audit/ux-dynamic-update-bugs-diagnosis.md` | Root-cause analysis of two UX bugs: admin order search and a second bug awaiting detail | 188 | Partial (investigation complete, fixes pending) |

### `docs/Instructions/`

| File | Description | Lines | Status |
|---|---|---|---|
| `docs/Instructions/creating-admin-users.md` | Step-by-step guide to creating Supabase Auth admin users and linking `profiles` rows; includes SQL snippets | 127 | Complete |

### `docs/` — Top Level

| File | Description | Lines | Status |
|---|---|---|---|
| `docs/legal-terms-current.md` | Verbatim extraction of the live Terms & Conditions and Privacy Policy from `src/app/terms/page.tsx` | 188 | Complete |
| `docs/owner-information-request.md` | Checklist of information needed from the business owner before launch (Information Officer name, registered address, company reg number, etc.) — split into Critical / Can-wait | 241 | In-progress (owner responses pending) |
| `docs/qa-testing-plan.md` | Manual QA testing plan — step/action/expected-result tables across 5 sections: Auth & RBAC, Buyer Flow, Admin Flow, Security, Regression Checklist | 320 | Complete |
| `docs/security-audit-2026-04-13.md` | Pre-production security audit (2026-04-13): 1 Critical, 8 High, 15 Medium, 11 Low findings; executive summary + per-severity findings + remediation priority | 1,006 | Complete |

### `docs/superpowers/plans/` (implementation plans)

| File | Description | Lines |
|---|---|---|
| `docs/superpowers/plans/2026-03-16-mobile-ui-fixes.md` | Mobile auth spinner, nav overlap, catalogue sidebar, order table layout | 104 |
| `docs/superpowers/plans/2026-03-18-enterprise-features.md` | 30-day credit limits + admin-approval, bulk discount engine, global notification banner | 1,629 |
| `docs/superpowers/plans/2026-03-27-security-audit-and-tests.md` | P1/P2 audit hardening: server-only enforcement, pricing utility extraction, Vitest suite | 974 |
| `docs/superpowers/plans/2026-03-28-ui-visual-wins.md` | Portal polish: dark-mode fix, navbar personalisation, VAT breakdown, `/catalogue` page | 728 |
| `docs/superpowers/plans/2026-04-02-buyer-auth-migration.md` | Buyer auth migration from custom JWT to Supabase Auth email+password | 1,978 |
| `docs/superpowers/plans/2026-04-02-remove-pos-status-column.md` | Remove "POS Status" column from `OrderLedger.tsx` | 103 |
| `docs/superpowers/plans/2026-04-02-system-simplified-ui.md` | Read-only admin review interface — remove action buttons | 354 |
| `docs/superpowers/plans/2026-04-04-landing-page.md` | Full portfolio landing page (Bebas Neue, 7 department rows, scroll-aware navbar) | 644 |
| `docs/superpowers/plans/2026-04-30-bugfixes-and-performance.md` | Cart data leak across sessions, admin role bug, loading skeletons, redundant getUser() call | 843 |
| `docs/superpowers/plans/2026-04-30-features-and-refactor.md` | Per-client custom pricing, multiple delivery locations, auto-generated account numbers | 1,763 |
| `docs/superpowers/plans/2026-04-30-perf-and-ux-round2.md` | Conditional hover-preview, eager catalogue images, drag-to-scroll category pills | 516 |
| `docs/superpowers/plans/2026-05-02-catalogue-perf.md` | ISR-cached `/catalogue`, nav-state API route to eliminate DB waterfall | 642 |
| `docs/superpowers/plans/2026-05-02-cookie-consent.md` | POPIA-compliant cookie consent banner, preferences modal, `/cookie-policy` page | 796 |
| `docs/superpowers/plans/2026-05-02-refund-invite-coolingoff.md` | Invite email redirect fix, CoolingOffModal, refund request flow | 1,274 |

### `docs/superpowers/specs/` (design specifications)

| File | Description | Lines |
|---|---|---|
| `docs/superpowers/specs/2026-04-02-buyer-auth-migration-design.md` | DB constraint changes, Custom Access Token hook, self-registration flow | 189 |
| `docs/superpowers/specs/2026-04-04-landing-page-design.md` | Typography, colour palette, layout structure, middleware fix | 219 |
| `docs/superpowers/specs/2026-04-30-bugfixes-and-performance-design.md` | Cart session isolation, admin role FormData bug, login performance root causes | 370 |
| `docs/superpowers/specs/2026-04-30-features-and-refactor-design.md` | Per-client custom pricing architecture, multiple locations, auto account numbers | 369 |
| `docs/superpowers/specs/2026-04-30-perf-and-ux-round2-design.md` | Hover-preview performance, catalogue eager loading, drag-scroll root causes | 214 |
| `docs/superpowers/specs/2026-05-02-catalogue-perf-design.md` | Catalogue ISR + portal layout waterfall fix: problem statement and proposed architecture | 113 |

### Root-Level Documentation

| File | Description | Lines | Status |
|---|---|---|---|
| `CODEBASE.md` | Comprehensive developer/agent reference: 14 sections — project identity, stack, directory map, DB schema, auth, pricing engine, credit system, server actions, API routes, email/PDF, testing, deployment, feature gates, key patterns | 662 | Complete |
| `HANDOVER_CHECKPOINT.md` | Point-in-time handover note for `feature/steel-matrix-prototype` branch (commit `c17fa84`, March 2026). Lists Tasks 1–8 done, 9–11 pending. **Stale — branch superseded.** | 155 | Stale |
| `QA-Plan.md` | ASCII-table-formatted export of `docs/qa-testing-plan.md`. Identical content. **Duplicate.** | 442 | Duplicate |

**No `README.md` exists at the repository root.**

**32 total documentation files** (12 in `docs/` outside `superpowers/`, 14 in `plans/`, 6 in `specs/`, 3 at root — excluding this inventory).

---

## Notes for Developer

The following items were encountered during investigation that are surprising, contradictory, or otherwise warrant attention before client engagement. This is not a gap analysis — no fixes are proposed here. Items are flagged for awareness only.

### N-01 — Two different business email domains in live UI

`info@armanufacturing.co.za` appears on the public landing page (`src/app/page.tsx` line 340) and cookie policy page (`src/app/cookie-policy/page.tsx` lines 125, 128).

`orders@arsteelmanufacturing.co.za` appears in eight contact blocks throughout the terms page (`src/app/terms/page.tsx` lines 73, 156, 265, 363, 386, 412, 505).

A visitor to the landing page and a visitor to the terms page see different email addresses for the same business.

### N-02 — Three unfilled legal placeholders visible to the public

The following strings are live in the current production code and visible to any user:

- `[INFORMATION OFFICER FULL NAME]` — `src/app/terms/page.tsx` line 153 (POPIA compliance requirement)
- `CIPC Reg: [TO BE PROVIDED]` — `src/app/page.tsx` line 253 (public landing page footer)
- `VAT No: [TO BE PROVIDED]` — `src/app/page.tsx` line 254 (public landing page footer)
- `[X] business days` (× 3) — `src/app/terms/page.tsx` lines 445, 449, 454 (delivery terms)

### N-03 — EFT payment submissions are never visible to admin

The `payments` table records EFT payment details at checkout (`src/app/actions/checkout.ts` line 549), including `amount`, `proof_url`, and `reference`. No admin page reads from this table. The admin Command Center approves orders but has no way to see what the buyer entered as their payment reference or uploaded as proof. This is documented in CODEBASE.md as "Phase 5."

### N-04 — `buyer_sessions` table is completely unwired

The `buyer_sessions` table exists in the Supabase schema with columns including `user_agent` and `ip_address`. It appears in `src/lib/supabase/types.ts` as a TypeScript type. There is no INSERT, SELECT, UPDATE, or DELETE referencing this table in any application code. A session-revocation system appears planned but never implemented.

### N-05 — `order_status_history` accumulates data that is never read

The immutable trigger `trg_orders_status_history` writes a row to `order_status_history` on every order status change. No application code ever reads this table — no admin page, no buyer page, no API route queries it. The audit trail exists in the database but is invisible through the application.

### N-06 — Phone number on landing page and terms is not a tappable link

`021 271 0526` appears twice as plain text (not a `tel:` URI) on the landing page (`src/app/page.tsx` line 336) and in the delivery section of the terms page (`src/app/terms/page.tsx` line 510). Mobile users cannot tap to call.

### N-07 — VAT rate hardcoded in cart components, not sourced from tenant config

`CartSidebar.tsx` and `CartReviewShell.tsx` hardcode `VAT_RATE = 0.15`. The `tenant_config` table has a `vat_rate` column. If the South African VAT rate changes, the cart display will require a code change, not just an admin settings update. (The invoice PDF does use the DB value.)

### N-08 — `SteelMatrixRow.tsx` is a substantial prototype never connected to the product

`src/components/demo/SteelMatrixRow.tsx` (~200 lines) implements an interactive per-kg/per-metre pricing calculator for Equal Angle Grade Mild Steel with hardcoded pricing data. It is never imported and therefore invisible, but it implies a planned pricing model that diverges from the current flat-price-per-unit model.

### N-09 — `tenant_config.report_emails` column is saved but never read

The settings form at `/admin/settings` writes to `tenant_config.report_emails`. Nothing in the application ever reads this column. The daily report cron job uploads a CSV to Supabase Storage rather than emailing it. The migration comment for this column says "wired up later."

### N-10 — `processing` and `fulfilled` order statuses have no transition code

Both statuses exist in the `order_status` Postgres ENUM and TypeScript union type. No server action or database trigger transitions any order to `processing` or `fulfilled`. Orders effectively move from `pending` → `confirmed` and `pending` → `cancelled`. The KPI query on `/admin` groups `confirmed` and `processing` together, suggesting `processing` was once used or planned.

### N-11 — Refund request data is not persisted

When a buyer submits the return/refund request form, the data (reason, date received, details) is sent via email only and is never written to the database. There is no refund log, no way to query past refund requests, and no admin view of submitted refunds. If the email is missed, the request is lost.

### N-12 — No README.md at repository root

The repository has no `README.md`. `CODEBASE.md` serves this purpose but uses a non-standard filename that some tooling (GitHub, CI systems) will not surface automatically.
