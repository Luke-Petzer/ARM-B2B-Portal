# QA & Testing Master Plan — B2B Ordering Portal

---

## Pre-Flight Checklist

Before starting any section, confirm the following:

- [ ] `init.sql` has been run successfully in the Supabase SQL Editor (all 12 tables visible)
- [ ] `seed.sql` has been run successfully (rows visible in `profiles`, `products`, `orders` tables)
- [ ] Admin user created in Supabase Auth Dashboard with metadata `{"role": "admin", "contact_name": "Your Name", "business_name": "SA Wholesale Direct"}`
- [ ] `.env.local` has `ADMIN_SUPER_EMAIL=luke@lpwebstudio.co.za` set
- [ ] `npm run dev` is running with no console errors
- [ ] Browser devtools are open (Network + Console tabs)

---

## Section 1 — Auth & RBAC

### 1.1 Buyer Login — Happy Path
**URL:** `/login`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter account number `TEST-EFT-001`, click Sign In | Redirected to `/shop` |
| 2 | Inspect the cookie storage | Cookie `sb-buyer-session` is present, `HttpOnly`, correct expiry |
| 3 | Navigate to `/admin` directly | Redirected to `/admin/login` (not `/shop`) |
| 4 | Navigate to `/admin/login` | Redirected to `/shop` (already authenticated as buyer) |

**Repeat** for `TEST-30D-002`.

### 1.2 Buyer Login — Failure Cases

| Step | Account Number | Expected Result |
|------|---------------|----------------|
| 1 | `INVALID-ACC` (non-existent) | Error message: "Account number not found" (or equivalent) |
| 2 | Leave field blank, click Sign In | HTML5 required validation or server error |
| 3 | `test-eft-001` (lowercase) | Error — account numbers are case-sensitive or normalised |

### 1.3 Buyer Login — Rate Limiting
1. Attempt 6 rapid failed logins from the same IP on `/login`
2. **Expected:** 6th attempt returns a rate-limit error ("Too many attempts…") — the Upstash Redis limiter (5 req/60s) has fired

### 1.4 Admin Login — Happy Path
**URL:** `/admin/login`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Enter admin email + password, click Sign In | Redirected to `/admin` (Command Center) |
| 2 | Inspect cookies | Supabase `sb-*-auth-token` cookie present |
| 3 | Navigate to `/login` (buyer login) | Loads normally — separate auth system |
| 4 | Navigate to `/shop` as admin | **Expected behaviour to confirm:** admin should be blocked or have no buyer cart — verify per your intended RBAC design |

### 1.5 Admin Login — Failure Cases

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Wrong password | Error message displayed on form |
| 2 | Non-existent email | Error message (do not reveal whether email exists) |

### 1.6 Route Protection — Unauthenticated

| Route | Expected for Unauthenticated User |
|-------|----------------------------------|
| `/shop` | Redirect to `/login` |
| `/shop/checkout` | Redirect to `/login` |
| `/admin` | Redirect to `/admin/login` |
| `/admin/products` | Redirect to `/admin/login` |
| `/admin/clients` | Redirect to `/admin/login` |
| `/admin/settings` | Redirect to `/admin/login` |
| `/admin/audit` | Redirect to `/admin/login` |

### 1.7 Admin Logout
1. While logged in as admin, click the logout button in the sidebar footer
2. **Expected:** Session cleared, redirected to `/admin/login`
3. Press browser Back — **Expected:** Cannot return to `/admin`, redirected to `/admin/login`

### 1.8 Buyer Logout
1. While logged in as buyer, trigger logout (if implemented, or clear the `sb-buyer-session` cookie manually)
2. Navigate to `/shop` — **Expected:** Redirected to `/login`

---

## Section 2 — The Buyer Flow

### 2.1 Product Catalogue
**URL:** `/shop` (logged in as `TEST-EFT-001`)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Page loads | 10 products visible (all 10 seeded products are `is_active = true`) |
| 2 | Deactivate one product in admin panel (toggle off in Products table) | Product disappears from `/shop` on refresh |
| 3 | Re-activate it | Product reappears |

### 2.2 Cart — Adding Items & Quantity Controls

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add `CLN-DEGREASER-5L` (R145.00), qty 3 | Cart shows 3 × R145.00 |
| 2 | Add `CLN-BLEACH-25L` (R89.50), qty 2 | Cart now has 2 line items |
| 3 | Increase degreaser qty to 5 | Quantity updates, line total recalculates to R725.00 |
| 4 | Decrease to 1 | Line total = R145.00 |
| 5 | Set qty to 0 or click Remove | Item removed from cart |
| 6 | Add item, navigate away, return to `/shop` | Cart persists (confirm via localStorage or cookie) |

### 2.3 Cart — Financial Calculations
Add the following to cart:
- `CLN-DEGREASER-5L` × 2 = R290.00
- `PAP-A4-COPY80` × 1 = R215.00

| Check | Expected Value |
|-------|---------------|
| Subtotal | R505.00 |
| VAT (15%) | R75.75 |
| Total | R580.75 |

**Verify:** All three figures match exactly. This confirms `vat_rate = 0.15` from `tenant_config` is being read correctly.

### 2.4 Checkout — EFT Divergent Routing
**Logged in as `TEST-EFT-001` (buyer_default)**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add items to cart, proceed to checkout | Checkout page loads with order summary |
| 2 | Confirm order | Redirected to **EFT Payment page** (`/shop/orders/[id]/payment` or equivalent) |
| 3 | Payment page shows | Bank details from `tenant_config` are visible (FNB, account number, branch code) |
| 4 | Payment page shows | Correct order reference number displayed (e.g. `ORD-000004`) |
| 5 | Upload a dummy proof-of-payment image | File accepted, no error |
| 6 | Submit payment proof | Redirected to order confirmation/status page |
| 7 | Check `payments` table in Supabase | New row with `status = 'pending'`, `proof_url` populated |
| 8 | Check `orders` table | Status remains `'pending'` until admin verifies |

### 2.5 Checkout — 30-Day Divergent Routing
**Logged in as `TEST-30D-002` (buyer_30_day)**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Add items to cart, proceed to checkout | Checkout page loads |
| 2 | Confirm order | **Bypasses payment page entirely** — redirected directly to order confirmation page |
| 3 | Confirmation page shows | Order reference visible, no payment instructions shown |
| 4 | Check `orders` table | `status = 'confirmed'`, `payment_method = '30_day_account'` |
| 5 | Check `payments` table | **No row** inserted for this order |

### 2.6 PDF Invoice Generation
1. After placing an order (either flow), navigate to the order confirmation/detail page
2. Click the "Download Invoice" or equivalent button
3. **Expected:** PDF downloads correctly — verify:
   - [ ] Supplier name: SA Wholesale Direct (Pty) Ltd
   - [ ] Bank details visible (for EFT orders)
   - [ ] Line items, quantities, and prices match the order
   - [ ] VAT line and totals are correct
   - [ ] Order reference number is visible
   - [ ] Buyer business name (Cape Fresh Produce) appears

### 2.7 Email Triggers
After placing an order:
1. Check the email inbox for the `SUPPLIER_EMAIL` address — **Expected:** Email received with PDF invoice attached
2. Check the buyer's email (`john.smit@capefresh.co.za` / `sarah.vandenberg@hhg.co.za`) — **Expected:** Order confirmation email received
3. Open both emails and verify content (product names, totals, reference number are correct)

> **Note:** Use Resend's dashboard (resend.com → Emails tab) to verify delivery if emails are not received.

---

## Section 3 — The Admin Flow

### 3.1 Products — Create (Add Product Drawer)
**URL:** `/admin/products`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Add Product" | Slide-over drawer opens from the right |
| 2 | Submit with all fields blank | Validation error (SKU, name, price required) |
| 3 | Fill in: SKU `TEST-NEW-001`, Name `Test Product`, Price `99.99`, select a Category | — |
| 4 | Click "Save Product" | Drawer closes, product appears in table without page reload |
| 5 | Verify in Supabase | Row visible in `products` table with `is_active = true` |
| 6 | Try to create another product with SKU `TEST-NEW-001` | Error: "A product with this SKU already exists" |

### 3.2 Products — Edit
1. Click the `⋯` menu on `CLN-DEGREASER-5L` → Edit
2. Change the price to `159.00`, click "Save Changes"
3. **Expected:** Drawer closes, table row reflects new price immediately
4. Verify `audit_log` has a new UPDATE row for the `products` table

### 3.3 Products — Active Toggle
1. Click the toggle switch in the Status column for `CLN-BLEACH-25L`
2. **Expected:** Toggle changes state immediately (optimistic update), no page reload
3. Login as buyer → product should no longer appear in `/shop`
4. Toggle it back on — buyer sees it again

### 3.4 Clients — Create
**URL:** `/admin/clients`

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Add Client" | Slide-over drawer opens |
| 2 | Submit empty form | Required field errors shown |
| 3 | Fill in Account No: `PROD-001`, Business Name: `Test Co`, Contact: `Test Person`, Role: EFT Default | — |
| 4 | Click "Save Client" | Drawer closes, client appears in table |
| 5 | Try login as new client on `/login` with `PROD-001` | **Expected:** Login succeeds, redirected to `/shop` |
| 6 | Try duplicate account number | Error: "A client with this account number already exists" |

### 3.5 Clients — Edit & Active Toggle
1. Open edit drawer for `TEST-EFT-001`
2. Change role to `30-Day Account` — click "Save Changes"
3. Login as `TEST-EFT-001`, add items, checkout
4. **Expected:** Now bypasses payment page (30-day flow)
5. Edit again, set role back to `EFT Default` and verify it reverts
6. Toggle the **Account Active** switch to OFF → "Save Changes"
7. Attempt login with `TEST-EFT-001` → **Expected:** Login rejected ("Account is inactive" or equivalent)
8. Re-activate and confirm login succeeds again

### 3.6 Clients — Search & Pagination
1. Type `Cape Fresh` in the search box, click Search
2. **Expected:** Only TEST-EFT-001 row visible
3. Type a non-existent value — **Expected:** "No clients match your search" empty state
4. Click Clear — **Expected:** All clients reload

### 3.7 Order Ledger — Viewing & Filtering
**URL:** `/admin` (Command Center / Order Ledger)

| Step | Check | Expected |
|------|-------|----------|
| 1 | Default view loads | 3 seeded orders visible in the ledger |
| 2 | Filter by status `pending` | Only Order 1 (EFT, pending) visible |
| 3 | Filter by status `fulfilled` | Only Order 3 (30-day, fulfilled) visible |
| 4 | Expand an order row | Line items, quantities, and totals visible |
| 5 | EFT orders show payment method | "EFT" badge visible |
| 6 | 30-day order shows payment method | "30-Day Account" badge visible |

### 3.8 Order Ledger — Mark as Fulfilled
1. Locate Order 2 (`confirmed` status), expand the row
2. Click "Mark as Processed" (or equivalent fulfilment button)
3. **Expected:**
   - [ ] Order status changes to `fulfilled` in the UI
   - [ ] `fulfilled_at` timestamp set in Supabase `orders` table
   - [ ] New row in `order_status_history` (confirmed → fulfilled)

### 3.9 CSV Export
1. On the Order Ledger, click the CSV Export / Download button
2. **Expected:** A `.csv` file downloads to your machine
3. Open the file and verify:
   - [ ] Header row present (Order Date, Reference, Account No., Business Name, …)
   - [ ] All 3 seeded orders present
   - [ ] Order 3 (30-day) shows `payment_method = 30_day_account`
   - [ ] Line items are expanded to one row each (multi-row orders)
   - [ ] Financials (subtotal, VAT, total) are correct
4. Apply a status filter (e.g., `fulfilled` only) and export again — **Expected:** Only fulfilled orders in the CSV

---

## Section 4 — Security

### 4.1 Settings Email Lock — Super Admin Access
**Logged in as the admin user with email `luke@lpwebstudio.co.za`**

| Step | Action | Expected |
|------|--------|----------|
| 1 | Look at the sidebar | **Settings** link is visible under System |
| 2 | Navigate to `/admin/settings` | Page loads — two cards (Company Profile + Banking Details) |
| 3 | Change Business Name to `SA Wholesale Direct (Pty) Ltd - UPDATED` | — |
| 4 | Click "Save Changes" | Success indicator appears ("Settings saved successfully") |
| 5 | Refresh `/admin/settings` | Updated name persists |
| 6 | Change VAT rate to `16` (16%), save | `vat_rate` in `tenant_config` updates to `0.16` |
| 7 | Set it back to `15`, save | Reverts to `0.15` |
| 8 | Click "Discard" after making unsaved changes | Form resets to last-saved values |

### 4.2 Settings Email Lock — Non-Super Admin Access
> This test requires a second admin account in Supabase Auth with a **different email** (not `luke@lpwebstudio.co.za`).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as the second admin | Sidebar loads — **Settings link is NOT visible** |
| 2 | Navigate directly to `/admin/settings` by typing the URL | Redirected to `/admin` (403 redirect) |
| 3 | Call `updateTenantConfigAction` directly (via a crafted POST) | Returns `{ error: "Unauthorised: only the super admin can update settings." }` |

> **Why this matters:** The email lock is enforced at both the UI layer (link hidden) and the server layer (action guard). The direct URL test confirms the page-level redirect works even if someone manually types the URL.

### 4.3 Audit Log Verification
**URL:** `/admin/audit`

| Step | Check | Expected |
|------|-------|----------|
| 1 | Page loads | Table shows audit entries from the seeded data and any actions performed |
| 2 | Each entry has a colored badge | INSERT = green, UPDATE = blue, DELETE = red |
| 3 | Find an entry for a product edited earlier | Action = `UPDATE`, Table = `products` |
| 4 | Find entries from Settings save | Action = `UPDATE`, Table = `tenant_config` |
| 5 | Actor column | Shows admin's name and email (not raw UUID) |
| 6 | Pagination | If >50 entries: Previous/Next buttons appear and work correctly |

### 4.4 RLS Boundary — Buyer Cannot Access Admin Data
While logged in as `TEST-EFT-001`:

| Attempt | Expected |
|---------|----------|
| `GET /admin/products` | Redirect to `/admin/login` |
| Direct Supabase query for another buyer's orders | Returns empty (RLS blocks it) — verify by checking the browser's network requests; no cross-profile data should leak |

### 4.5 Inactive Buyer Cannot Login
1. In `/admin/clients`, set `TEST-30D-002` to inactive
2. Attempt login with `TEST-30D-002` on `/login`
3. **Expected:** Error — account is inactive (login rejected before JWT is issued)
4. Re-activate in admin and confirm login succeeds

---

## Regression Checklist

Run this quick smoke-test after any code change:

- [ ] Both buyer logins work (`TEST-EFT-001`, `TEST-30D-002`)
- [ ] Admin login works
- [ ] `/shop` renders all active products
- [ ] Cart totals (subtotal + VAT = total) are correct
- [ ] EFT checkout → payment page (not confirmation)
- [ ] 30-day checkout → confirmation page (skips payment)
- [ ] Admin can toggle a product on/off and it reflects in `/shop`
- [ ] Settings page loads for super admin, redirects for non-super admin
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
