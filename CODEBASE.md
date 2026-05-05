# AR Steel Manufacturing — B2B/B2C Ordering Portal

> Comprehensive codebase documentation for developers and AI agents.

---

## 1. Project Identity

**Name:** AR Steel Manufacturing Ordering Portal  
**Purpose:** Order placement portal for AR Steel Manufacturing (Pty) Ltd, serving both B2B (trade) and B2C (consumer) customers. Buyers browse a product catalogue, build orders, and check out on credit (30-day terms) or via EFT. Admins view placed orders, manage products and client accounts.

> **Scope clarification (updated 2026-05):** This platform handles order **placement** only. Once an order is submitted, processing, payment verification, and dispatch are handled in the client's ERP and via email — NOT in this platform. The admin dashboard is a read-only source of truth for placed orders. Any code or comment that implies otherwise reflects an earlier design that was de-scoped.

> **CPA compliance note (updated 2026-05):** This platform is built to support the substantive requirements of the Consumer Protection Act (Act 68 of 2008) for e-commerce sale of goods — including cooling-off rights (s.44 of ECT Act), implied warranties (CPA s.56), and right to return (CPA s.56(2)). The business is responsible for honouring these obligations in practice. Final legal review by a qualified attorney is recommended before public launch. The platform provides the infrastructure for compliance; the business's actual practices determine whether compliance is maintained.

**Tech Stack:**

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.1.x |
| UI | React + Tailwind CSS + Radix primitives | React 19 / Tailwind 3 |
| Client State | Zustand (persisted) | 5.x |
| Database | Supabase (PostgreSQL + RLS + Auth) | supabase-js 2.98 |
| Auth (Buyers) | Custom JWT via `jose` | 6.x |
| Auth (Admins) | Supabase Auth (@supabase/ssr) | 0.9.x |
| Email | Resend + React Email | 6.x |
| PDF | @react-pdf/renderer | 4.x |
| Rate Limiting | Upstash Redis | ratelimit 2.x |
| Forms | react-hook-form + Zod v4 | 7.x / 4.x |
| Testing | Vitest | 4.x |
| Hosting | Vercel | — |

---

## 2. Getting Started

### Prerequisites
- Node.js 20+
- pnpm (or npm)
- Supabase project (with migrations applied)
- Upstash Redis database
- Resend account with verified domain

### Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Bypasses RLS for admin operations |
| `SUPABASE_JWT_SECRET` | Server | Signs buyer session JWTs |
| `UPSTASH_REDIS_REST_URL` | Server | Rate limiting backend |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Rate limiting auth |
| `RESEND_API_KEY` | Server | Transactional email |
| `RESEND_FROM_EMAIL` | Server | Sender address |
| `SUPPLIER_EMAIL` | Server | Receives PDF invoice per order |
| `NEXT_PUBLIC_APP_URL` | Public | Base URL for links in emails |
| `ADMIN_SUPER_EMAIL` | Server | Super admin email (settings access) |
| `CRON_SECRET` | Server | Authenticates Vercel CRON requests |

### Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

---

## 3. Architecture

### Request Flow (Buyer)

```
Browser → Vercel Edge → Next.js App Router
  ├── Layout: getSession() reads cookie → verifyBuyerSession(JWT)
  ├── Page: unstable_cache (shared catalogue) + per-client pricing overlay
  └── Server Action: re-fetches DB prices (never trusts client), calls create_order_atomic()
```

### Request Flow (Admin)

```
Browser → Vercel Edge → Next.js App Router
  ├── Layout: getSession() → Supabase Auth getUser() → profiles lookup
  ├── Page: adminClient queries (service role, bypasses RLS)
  └── Server Action: requireAdmin() guard → adminClient mutations
```

### Key Architectural Decisions

1. **Dual auth paths** — Buyers use custom JWTs (account number + password login, no Supabase Auth row needed). Admins use Supabase Auth with email/password. Unified via `getSession()`.

2. **Price trust boundary** — Client-supplied prices are display-only. All financial calculations use DB-sourced values. The `computeEffectiveUnitPrice()` function ONLY accepts `DbProductPricing` objects fetched server-side.

3. **Shared catalogue cache** — `unstable_cache` with 60-second TTL and `revalidateTag("catalogue")` for instant admin-triggered invalidation. Per-client pricing is applied AFTER the shared cache fetch. TTL is deliberately short: `revalidateTag` only affects future requests, so a buyer already on the page won't see changes until they navigate; the checkout guard is the hard safety net for inactive products.

4. **Atomic order creation** — PostgreSQL function `create_order_atomic()` runs as SECURITY DEFINER with service_role guard. Inserts order + order_items in a single transaction.

5. **Fail-closed credit** — `checkCreditStatus()` returns `blocked: true` on any DB error (status_indeterminate). Safer to block than accidentally approve.

6. **Feature gating** — Disabled features use named constants (`const FEATURE_ENABLED = false`) at file top. Code is preserved; features can be reinstated by flipping to `true`.

---

## 4. Directory Map

```
src/
├── app/
│   ├── layout.tsx              # Root layout (Inter font, metadata)
│   ├── globals.css             # Tailwind base + custom properties
│   ├── (auth)/                 # Public auth pages
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── verify-success/page.tsx
│   │   └── admin/login/page.tsx
│   ├── (portal)/               # Buyer-facing (JWT-protected)
│   │   ├── layout.tsx          # Session guard + NavBar + GlobalBanner + footer
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Catalogue (shared cache + pricing overlay)
│   │   │   ├── CatalogueShell.tsx  # Client component: search/filter/categories
│   │   │   └── statement/page.tsx  # [DISABLED] Account statement
│   │   ├── cart/
│   │   │   ├── page.tsx        # Cart data fetching (addresses)
│   │   │   └── CartReviewShell.tsx # Client component: review + checkout
│   │   ├── orders/page.tsx     # Order history
│   │   ├── order-sheet/page.tsx
│   │   └── checkout/
│   │       ├── payment/page.tsx    # EFT payment instructions
│   │       └── confirmed/page.tsx  # Credit order confirmation
│   ├── (admin)/                # Admin panel (Supabase Auth-protected)
│   │   ├── layout.tsx          # Sidebar + header + session guard
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       ├── clients/page.tsx     # Client management
│   │       ├── products/page.tsx    # Product management
│   │       ├── notifications/page.tsx
│   │       ├── settings/page.tsx
│   │       └── audit/page.tsx
│   ├── actions/                # Server Actions
│   │   ├── auth.ts             # Login, register, logout, password reset
│   │   ├── checkout.ts         # Order creation (pricing + atomic insert)
│   │   ├── admin.ts            # All admin CRUD operations
│   │   ├── addresses.ts        # Add shipping address
│   │   └── order.ts            # Reorder action
│   └── api/                    # Route Handlers
│       ├── invoice/[orderId]/route.ts  # PDF invoice download
│       ├── reports/daily/route.ts      # CSV download (admin)
│       └── cron/daily-report/route.ts  # Vercel CRON endpoint
├── components/
│   ├── ui/                     # Radix-based primitives (shadcn/ui pattern)
│   ├── portal/                 # Buyer UI components
│   │   ├── NavBar.tsx
│   │   ├── CartSidebar.tsx
│   │   ├── ProductRow.tsx
│   │   ├── QuantityStepper.tsx
│   │   ├── OrderHistoryTable.tsx
│   │   ├── DeliveryAddressPicker.tsx
│   │   ├── GlobalBanner.tsx
│   │   └── CartGuard.tsx
│   ├── admin/                  # Admin UI components
│   │   ├── OrderLedger.tsx
│   │   ├── ClientDrawer.tsx
│   │   ├── CreditDrawer.tsx
│   │   ├── ProductDrawer.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminMobileNav.tsx
│   │   ├── AdminLogoutButton.tsx
│   │   ├── GlobalBannerAdmin.tsx
│   │   └── SettingsForm.tsx
│   ├── auth/                   # Auth-related components
│   │   ├── AuthCard.tsx
│   │   └── AddressGateForm.tsx
│   ├── PublicNavBar.tsx        # Shared nav for logged-out pages
│   └── CoolingOffNotice.tsx
├── emails/                     # React Email templates
│   ├── BuyerReceipt.tsx
│   ├── ClientStatement.tsx
│   ├── DispatchNotification.tsx
│   ├── SupplierInvoice.tsx
│   └── OrderApprovedNotification.tsx
├── hooks/
│   └── useDragScroll.ts        # Horizontal scroll drag interaction
└── lib/
    ├── auth/
    │   ├── buyer.ts            # JWT verification + account number validation
    │   └── session.ts          # Unified session resolver (cache()-wrapped)
    ├── supabase/
    │   ├── admin.ts            # Service-role client (bypasses RLS)
    │   ├── server.ts           # Anon-key client (RLS-enforced)
    │   ├── middleware.ts       # Middleware client factory
    │   ├── config.ts           # URL + key exports
    │   └── types.ts            # Generated Database types
    ├── checkout/
    │   └── pricing.ts          # Pure financial calculations
    ├── pricing/
    │   └── resolveClientPricing.ts  # Per-client price resolution
    ├── credit/
    │   └── checkCreditStatus.ts     # Admin-side credit gate
    ├── cart/
    │   └── store.ts            # Zustand cart (persisted, discount-aware)
    ├── pdf/
    │   └── invoice.tsx         # PDF template + renderInvoiceToBuffer()
    ├── reports/
    │   └── daily-report.ts     # CSV generator (formula injection safe)
    └── rate-limit.ts           # Upstash Redis rate limiting

supabase/
├── migrations/                 # 23 migration files (chronological)
└── init.sql                    # Full schema (for fresh environments)

tests/
└── audit/                      # 23 test files, 270 tests
    ├── auth/                   # Session, login, signup, rate-limit tests
    ├── financial/              # Pricing + client pricing tests
    ├── credit/                 # Credit status tests
    ├── cart/                   # Cart isolation + logout clear
    ├── order/                  # State machine tests
    ├── admin/                  # Client drawer submit tests
    ├── api/                    # Route access tests
    ├── email/                  # Fulfillment isolation tests
    ├── inventory/              # Zombie stock tests
    ├── security/               # Secret boundary tests
    ├── quality/                # Tech debt detection
    └── ui/                     # Component interaction tests
```

---

## 5. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | All users (buyers + admins). Links to `auth.users` via `auth_user_id`. |
| `products` | Product catalogue (SKU, price, cost_price, pack_size, bulk discount fields) |
| `categories` | Product categories (name, slug, display_order) |
| `product_images` | Product image URLs (multi-image, primary flag) |
| `orders` | Order headers (status, totals, payment_status, shipping_address JSONB) |
| `order_items` | Line items (snapshotted unit_price, quantity, line_total) |
| `addresses` | Buyer shipping/billing addresses |
| `client_custom_prices` | Per-client per-product custom pricing overrides |
| `global_settings` | Singleton: banner message, active flag |
| `tenant_config` | Singleton: company info, VAT rate, bank details |
| `audit_log` | Trigger-populated audit trail (all INSERT/UPDATE/DELETE on audited tables) |
| `order_status_history` | Immutable status change log (DB trigger, never queried by application) |
| `buyer_sessions` | Dormant — schema reserved for future session-revocation feature |

### Key Columns on `profiles`

- `role`: `admin | buyer_default | buyer_30_day`
- `admin_role`: `manager | employee` (null for buyers)
- `credit_limit`: Numeric, null = unlimited
- `client_discount_pct`: Blanket discount percentage for custom pricing
- `account_number`: Auto-generated `ARM-NNNNNN` format
- `payment_terms_days`: Payment terms (e.g., 30)
- `is_active`: Boolean, deactivated clients can't log in

### Order Status Flow

```
pending → confirmed  (terminal — processed via ERP)
        ↘ cancelled
```

- `pending`: Newly placed; awaiting admin confirmation
- `confirmed`: Admin-approved (EFT verified or 30-day credit granted) — terminal state in this platform
- `cancelled`: Admin-cancelled from `pending` only

> **Note:** `processing` and `fulfilled` exist in the DB enum and TypeScript types but no application code transitions to them. Order workflow beyond `confirmed` is handled in the client's ERP. These statuses are preserved in the enum for backward compatibility only.

### Payment Status

```
unpaid → credit_approved → settled
      → paid (EFT proof submitted)
```

### RLS Model

- Buyers can only read their own orders/addresses/profile
- Admins use `adminClient` (service role) which bypasses RLS entirely
- `create_order_atomic()` is SECURITY DEFINER, restricted to service_role via explicit check
- Mutations from server actions always go through `adminClient`

### Dormant Tables

**`buyer_sessions`:** Schema exists (columns: `user_agent`, `ip_address`, timestamps). Reserved for a planned session-revocation system. Currently unwired — no INSERT or SELECT exists in any application code. Do not rely on this table for session data; Supabase Auth manages active sessions. If a session-revocation feature is added in a future phase, this table is the intended backing store.

**`order_status_history`:** Populated by the `trg_orders_status_history` database trigger on every INSERT or UPDATE to `orders`. Records `from_status`, `to_status`, and `changed_by` (auth.uid()). Currently no application code queries this table — no admin page or API route surfaces it. It accumulates as an immutable audit trail for POPIA compliance. May be exposed via admin UI in a future phase if operational need arises.

### Migrations Timeline

| Date | Migration | Purpose |
|------|-----------|---------|
| 2026-03-18 | `enterprise_features` | credit_limit, bulk discounts, global_settings |
| 2026-03-19 | `order_notes` | Notes field on orders |
| 2026-03-21 | `order_payment_status` | Payment status tracking |
| 2026-03-25 | `feature_batch` | Multiple feature additions |
| 2026-03-25 | `pack_size` + `constraints` | Pack size on products |
| 2026-03-26 | `emergency_hardening` | Security fixes |
| 2026-04-02 | `buyer_auth_migration` | Custom JWT auth system |
| 2026-04-03 | `buyer_trigger_conflict_guard` | Trigger conflict resolution |
| 2026-04-14 | `C1–L11` (9 files) | Security audit remediation |
| 2026-04-30 | `account_number_sequence` | Auto-generated ARM-NNNNNN |
| 2026-04-30 | `client_custom_pricing` | Per-client pricing table |
| 2026-04-30 | `order_shipping_address` | Shipping address on orders |

---

## 6. Authentication & Authorization

### Buyer Authentication

1. Buyer submits email + password on `/login`
2. `loginAction` validates via Supabase Auth (`signInWithPassword`)
3. On success, fetches profile from `profiles` table
4. Mints a custom JWT (HS256, signed with `SUPABASE_JWT_SECRET`) containing:
   - `sub`: profile ID
   - `app_role`: buyer role
   - `account_number`: ARM-NNNNNN
5. Sets `sb-buyer-session` cookie (httpOnly, secure, sameSite: lax)
6. Redirects to `/dashboard`

### Admin Authentication

1. Admin submits email + password on `/admin/login`
2. Standard Supabase Auth session (managed by `@supabase/ssr`)
3. Session cookies set automatically by Supabase SSR middleware
4. `getSession()` detects Supabase Auth session, verifies email confirmed
5. Fetches profile with `adminClient`, checks `role === "admin"`

### Session Resolution (`getSession()`)

```
1. Check sb-buyer-session cookie → verifyBuyerSession(JWT) → BuyerSession
2. Fallback: Supabase Auth getUser() → profile lookup → AdminSession
3. Neither: return null
```

- Wrapped in React `cache()` — deduplicated per server request
- Layout and page can both call `getSession()` without redundant calls

### Role Hierarchy

| Role | Access |
|------|--------|
| `admin` (manager) | Full admin panel |
| `admin` (employee) | Admin panel (restricted settings) |
| `buyer_30_day` | Portal + credit checkout + custom pricing eligible |
| `buyer_default` | Portal + EFT-only checkout |

### Super Admin

- Determined by `ADMIN_SUPER_EMAIL` env var (comma-separated list)
- Grants access to `/admin/settings` (tenant config, dangerous operations)
- Checked at session resolution time

---

## 7. Pricing Engine

### Price Resolution Priority (per product, per client)

```
1. Custom price (client_custom_prices table) — highest priority
2. Client discount % (profiles.client_discount_pct) — blanket reduction
3. Base product price (products.price) — fallback
```

Implemented in `src/lib/pricing/resolveClientPricing.ts`:
- `resolveProductPrices(products, customPrices, discountPct)` — pure function, no DB calls

### Bulk Discount Calculation

Products may have:
- `discount_type`: `"percentage"` or `"fixed"`
- `discount_threshold`: minimum quantity to trigger
- `discount_value`: discount amount (% or fixed ZAR)

Implemented in `src/lib/checkout/pricing.ts`:
- `computeEffectiveUnitPrice(dbProduct, quantity)` — applies threshold check + discount
- `computeLineItem(dbProduct, quantity)` — returns effective price, line total, discount %
- `computeOrderTotals(lineTotals, discountSavings, vatRate)` — aggregates to order level

### VAT

- All catalogue prices are VAT-exclusive
- VAT is computed at order level: `vatAmount = subtotal × vatRate`
- VAT rate stored in `tenant_config` table
- `totalAmount = subtotal + vatAmount`

### Security Invariant

**Client-supplied prices are NEVER used in financial calculations.**

The cart store holds `unitPrice` for display only. At checkout:
1. Server fetches all product rows from DB by `productId`
2. Fetches client custom prices and discount %
3. Resolves effective price per item server-side
4. Passes resolved prices to `computeLineItem()`
5. Snapshots `unit_price` on `order_items` row (immutable after creation)

### `r2()` Rounding

All monetary calculations use `r2(n)` = `parseFloat(n.toFixed(2))` — matches PostgreSQL `ROUND(x, 2)` for normal values. Applied at every intermediate step to prevent floating-point drift.

---

## 8. Credit System

### Overview

30-day account buyers can checkout "on credit" — their order is placed as `pending` and an admin must approve it. The credit system gates whether approval should be allowed.

### Credit Status Check (`checkCreditStatus`)

Called admin-side only. Returns `{ blocked, reason, outstanding, creditLimit }`.

**Blocking rules:**

1. **Overdue** — Any confirmed order with `confirmed_at` before the 1st of the current month
2. **Limit exceeded:**
   - `credit_limit = null` → unlimited, never blocks
   - `credit_limit = 0` → COD only, always blocks
   - `credit_limit > 0` → blocks if `outstanding > credit_limit`

### Credit Drawer (Admin UI)

- Shows utilization bar (% of credit limit used)
- Lists all unpaid orders with checkboxes
- "Settle Selected" marks orders as paid (reduces outstanding)
- Credit limit is editable (save updates `profiles.credit_limit`)

### Buyer Visibility

Buyers do NOT see their credit limit or utilization. This is a deliberate business requirement — credit management is admin-only.

---

## 9. Server Actions

### `src/app/actions/auth.ts`

| Action | Purpose | Auth |
|--------|---------|------|
| `loginAction(formData)` | Email/password login (rate-limited) | Public |
| `signUpAction(formData)` | Register new buyer account | Public |
| `logoutAction()` | Clear session cookies, redirect | Authenticated |
| `forgotPasswordAction(formData)` | Send password reset email | Public |
| `resetPasswordAction(formData)` | Set new password from reset link | Public (with token) |

### `src/app/actions/checkout.ts`

| Action | Purpose | Auth |
|--------|---------|------|
| `checkoutAction(rawItems, orderNotes, clientSubmissionId?, addressId?)` | Create order atomically | Buyer |

Key behaviour:
- Validates all items exist in DB
- Fetches custom pricing for the buyer
- Computes all prices server-side
- Calls `create_order_atomic()` PostgreSQL function
- Sends emails (buyer receipt, supplier invoice)
- Returns redirect URL or error

### `src/app/actions/admin.ts`

| Action | Purpose |
|--------|---------|
| `createClientAction(formData)` | Create buyer profile |
| `updateClientAction(formData)` | Update client details + credit limit |
| `createProductAction(formData)` | Add product to catalogue |
| `updateProductAction(formData)` | Update product details + discounts |
| `approveOrderAction(orderId)` | Pending → Confirmed |
| `markProcessedAction(orderId)` | Confirmed → Processed |
| `markDispatchedAction(orderId, trackingNumber?)` | Processed → Dispatched |
| `bulkMarkOrdersSettledAction(orderIds)` | Mark orders as paid |
| `sendClientStatementAction(clientId)` | Email statement to client |
| `searchProductsAction(query)` | Search products by SKU/name |
| `listClientCustomPricesAction(profileId)` | Get custom prices for client |
| `setClientCustomPriceAction(profileId, productId, price, notes?)` | Upsert custom price |
| `removeClientCustomPriceAction(profileId, productId)` | Delete custom price |
| `updateClientDiscountPctAction(profileId, pct)` | Update blanket discount |

All admin actions use `requireAdmin()` guard (throws redirect on failure).

### `src/app/actions/addresses.ts`

| Action | Purpose | Auth |
|--------|---------|------|
| `addAddressAction(formData)` | Add shipping address | Buyer |

Returns `{ success: true, addressId: string }` on success.

### `src/app/actions/order.ts`

| Action | Purpose | Auth |
|--------|---------|------|
| `reorderAction(formData)` | Load previous order into cart | Buyer |

---

## 10. API Routes

### `GET /api/invoice/[orderId]`

- **Auth:** Session required (buyer must own the order)
- **Rate limited:** Per-session, "invoice" bucket
- **Validates:** UUID format on orderId
- **Returns:** PDF buffer as `application/pdf`
- **Scoped:** `profile_id` filter ensures buyers only access their own invoices

### `GET /api/reports/daily`

- **Auth:** Admin session required
- **Params:** `?date=YYYY-MM-DD` (optional, defaults to today)
- **Returns:** CSV file download
- **Content:** All confirmed orders for the date, one row per line item

### `GET /api/cron/daily-report`

- **Auth:** `Authorization: Bearer <CRON_SECRET>` (timing-safe comparison)
- **Triggered:** Vercel CRON at 23:59 UTC daily
- **Action:** Generates CSV and uploads to Supabase Storage (`daily-reports` bucket)

---

## 11. Email & PDF

### Email Templates (`src/emails/`)

| Template | Trigger | Recipient |
|----------|---------|-----------|
| `BuyerReceipt` | Order placed | Buyer |
| `SupplierInvoice` | Order placed | `SUPPLIER_EMAIL` |
| `OrderApprovedNotification` | Admin approves order | Buyer |
| `DispatchNotification` | Admin marks dispatched | Buyer |
| `ClientStatement` | Admin sends statement | Client email |

All templates use `@react-email/components` and are rendered server-side via Resend.

### PDF Invoice (`src/lib/pdf/invoice.tsx`)

- Uses `@react-pdf/renderer` with custom Inter font
- Generates full invoice: company details, buyer info, line items, VAT breakdown, bank details
- Called by `/api/invoice/[orderId]` route handler
- `renderInvoiceToBuffer(props)` returns a `Buffer` ready for HTTP response

---

## 12. Testing

### Strategy

- **Framework:** Vitest with `node` environment
- **Coverage:** Focused on `lib/checkout`, `lib/auth`, `lib/credit`
- **Count:** 270 tests across 23 files
- **Pattern:** Unit tests for pure functions, integration tests mock Supabase client

### Test Categories

| Category | What it tests |
|----------|--------------|
| `auth/` | Session verification, login action, signup, rate limiting, cached session dedup |
| `financial/` | Pricing calculations, client pricing resolution, bulk discount maths |
| `credit/` | Credit status blocking rules |
| `cart/` | Session isolation, logout clears cart |
| `order/` | State machine transitions |
| `admin/` | Client drawer form submission |
| `api/` | Route access control |
| `email/` | Fulfillment email isolation |
| `security/` | Secret boundary (no server secrets in client bundles) |
| `quality/` | Tech debt detection |
| `ui/` | Component interactions (hover, drag scroll) |

### Running Tests

```bash
pnpm test                    # All tests, single run
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage report
npx vitest run tests/audit/financial/  # Specific directory
```

---

## 13. Deployment

### Vercel Configuration

- **Build:** `next build`
- **Framework:** Next.js (auto-detected)
- **Node:** 20.x
- **CRON:** Single job in `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/daily-report", "schedule": "59 23 * * *" }] }
  ```

### Environment Variable Categories (Vercel Dashboard)

| Category | Variables |
|----------|-----------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` |
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPPLIER_EMAIL` |
| App | `NEXT_PUBLIC_APP_URL`, `ADMIN_SUPER_EMAIL`, `CRON_SECRET` |

### Image Optimization

`next.config.ts` configures remote image patterns for Supabase Storage:
```
https://*.supabase.co/storage/v1/object/public/**
```

---

## 14. Feature Gates

Features that are built but currently disabled:

| Feature | Gate Location | Constant | Re-enable |
|---------|--------------|----------|-----------|
| Statement page | `src/app/(portal)/dashboard/statement/page.tsx` | `STATEMENT_PAGE_ENABLED` | Set to `true`, remove redirect |
| Statement nav link | `src/components/portal/NavBar.tsx` | `STATEMENT_NAV_ENABLED` | Set to `true` |
| Send Statement button | `src/components/admin/CreditDrawer.tsx` | `SEND_STATEMENT_ENABLED` | Set to `true` |

**Reason disabled:** Payments are managed offline. The statement page would show permanently inaccurate outstanding balances since the system has no way to know when payments are received. These features should be reinstated once payment recording is implemented in the platform.

---

## Appendix: Key Patterns & Conventions

### Server Action Pattern
```typescript
"use server";
// 1. Validate input (Zod)
// 2. Check auth (getSession() or requireAdmin())
// 3. Perform mutation (adminClient)
// 4. Return { error: string } | void
```

### Component Naming
- Page data fetching: Server Component (`.tsx` in `app/`)
- Interactive UI: Client Component with `"use client"` directive
- Naming: `*Shell.tsx` = client wrapper for a page's interactive parts
- Drawers: Sheet (slide-over) pattern using Radix Dialog

### State Management
- Server state: fetched in Server Components, passed as props
- Client state: Zustand for cart (persisted to localStorage as `b2b-cart`)
- Mutations: `useTransition` + server actions (no SWR/React Query)

### Styling
- Tailwind utility classes exclusively
- `cn()` utility for conditional class merging (clsx + tailwind-merge)
- Design tokens via CSS custom properties in `globals.css`
- No CSS modules or styled-components

### Error Handling
- Server actions return `{ error: string }` on failure (never throw)
- Pages log errors with `console.error("[context]", message)` and render graceful fallbacks
- Rate limit failures return human-readable messages with retry-after seconds
