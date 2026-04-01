# UI Visual Wins — Portal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver client-facing visual improvements across dark-mode fix, navbar personalisation, financial breakdowns, and a new catalogue/PDF page — without breaking any existing tests or server logic.

**Architecture:** All changes are confined to UI/layout components and the portal layout's data-fetch. Server actions and pricing logic are unchanged. The new `/catalogue` page is a standalone Next.js app route that serves a PDF embed. Order history VAT display uses the `subtotal` and `vat_amount` columns already stored in `orders`.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v3, Zustand, Supabase (adminClient), Vitest, TypeScript

---

## File Map

| Task | Files |
|------|-------|
| T1 — Dark mode lock | `src/app/layout.tsx` |
| T2 — Logo resize | `src/components/portal/NavBar.tsx` |
| T3 — "More Information" button | `src/components/portal/ProductRow.tsx` |
| T4 — Navbar business name | `src/app/(portal)/layout.tsx`, `src/components/portal/NavBar.tsx` |
| T5 — CartSidebar VAT rows | `src/components/portal/CartSidebar.tsx` |
| T6 — Order history VAT rows | `src/app/(portal)/orders/page.tsx`, `src/components/portal/OrderHistoryTable.tsx` |
| T7 — Order history accordion styling | `src/components/portal/OrderHistoryTable.tsx` |
| T8 — Nav rename + /order-sheet route | `src/components/portal/NavBar.tsx`, `src/app/(portal)/order-sheet/page.tsx` (new), `src/app/(portal)/dashboard/page.tsx` redirect |
| T9 — New /catalogue PDF page | `src/app/(portal)/catalogue/page.tsx` (new) |

---

### Task 1: Force Light Mode — Dark Mode Crisis Fix

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Read the current layout**

Read `src/app/layout.tsx`. Confirm line 22 contains `<html lang="en" className="h-[100dvh] overflow-hidden">`.

- [ ] **Step 2: Apply the fix**

Change `src/app/layout.tsx` line 22 from:
```tsx
<html lang="en" className="h-[100dvh] overflow-hidden">
```
to:
```tsx
<html lang="en" className="light h-[100dvh] overflow-hidden" style={{ colorScheme: "light" }}>
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/lukepetzer/LP-Web-Studio/Clients/Rasheed-B2B/Codebase/rasheed-ordering-portal
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Run existing tests**

```bash
npm test 2>&1 | tail -10
```
Expected: all tests pass (no change to server logic).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(ui): force light color scheme to prevent OS dark-mode bleed"
```

---

### Task 2: Logo Size Bump

**Files:**
- Modify: `src/components/portal/NavBar.tsx`

- [ ] **Step 1: Update the Image dimensions**

In `src/components/portal/NavBar.tsx` at line 51–56, change:
```tsx
<Image
  src="/logo.png"
  alt="AR Steel Manufacturing"
  height={36}
  width={150}
  priority
  className="object-contain"
/>
```
to:
```tsx
<Image
  src="/logo.png"
  alt="AR Steel Manufacturing"
  height={48}
  width={200}
  priority
  className="object-contain"
/>
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/NavBar.tsx
git commit -m "fix(ui): increase navbar logo size (48×200)"
```

---

### Task 3: Replace ChevronDown with "More Information" Button

**Files:**
- Modify: `src/components/portal/ProductRow.tsx`

The current description button (lines 103–116) uses a small `ChevronDown` icon as the only affordance. We replace it with a visible labelled button while keeping the expand/collapse behaviour. On desktop the button lives in the "Description" column; on mobile it's inline.

- [ ] **Step 1: Remove the ChevronDown import and replace the button**

In `src/components/portal/ProductRow.tsx` line 5, change:
```tsx
import { Package, Tag, ChevronDown } from "lucide-react";
```
to:
```tsx
import { Package, Tag } from "lucide-react";
```

Then replace lines 103–116:
```tsx
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            aria-controls={`desc-panel-${productId}`}
            className="flex items-center gap-1 text-left w-full min-w-0 md:pr-8 cursor-pointer group/desc"
          >
            <span className="text-sm text-gray-500 truncate flex-1 min-w-0">
              {description ?? name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform duration-200 group-hover/desc:text-slate-600 ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
```
with:
```tsx
          <div className="flex flex-col gap-1 min-w-0 md:pr-4">
            <span className="text-sm text-gray-500 truncate">
              {description ?? name}
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-controls={`desc-panel-${productId}`}
              className="w-fit text-xs font-medium px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              {isExpanded ? "Hide Details" : "More Information"}
            </button>
          </div>
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/ProductRow.tsx
git commit -m "feat(ui): replace chevron icon with 'More Information' button on product rows"
```

---

### Task 4: Navbar Business Name — "Welcome, Acme Corp"

**Files:**
- Modify: `src/app/(portal)/layout.tsx`
- Modify: `src/components/portal/NavBar.tsx`

The portal layout is a Server Component that already calls `getSession()`. We add a second DB query for `business_name` keyed on `profileId`, then pass it as a prop to `NavBar`. `NavBar` (a Client Component) then renders it.

- [ ] **Step 1: Add businessName fetch to portal layout**

In `src/app/(portal)/layout.tsx`, change the `Promise.all` call and the `NavBar` render. Current code lines 15–44:

```tsx
  const [session, { data: settings, error: bannerError }] = await Promise.all([
    getSession(),
    adminClient
      .from("global_settings")
      .select("banner_message, is_banner_active")
      .eq("id", 1)
      .single(),
  ]);
```

Change to:

```tsx
  const [session, { data: settings, error: bannerError }] = await Promise.all([
    getSession(),
    adminClient
      .from("global_settings")
      .select("banner_message, is_banner_active")
      .eq("id", 1)
      .single(),
  ]);

  let businessName: string | null = null;
  if (session?.profileId) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_name")
      .eq("id", session.profileId)
      .single();
    businessName = profile?.business_name ?? null;
  }
```

Then change line 38:
```tsx
      <NavBar role={session?.role as AppRole | undefined} />
```
to:
```tsx
      <NavBar role={session?.role as AppRole | undefined} businessName={businessName} />
```

- [ ] **Step 2: Add businessName prop to NavBar**

In `src/components/portal/NavBar.tsx`, change the `NavBarProps` interface (lines 18–20):
```tsx
interface NavBarProps {
  role?: AppRole;
}
```
to:
```tsx
interface NavBarProps {
  role?: AppRole;
  businessName?: string | null;
}
```

Change the function signature (line 22):
```tsx
export default function NavBar({ role }: NavBarProps) {
```
to:
```tsx
export default function NavBar({ role, businessName }: NavBarProps) {
```

Then in the right-side desktop section (between the cart icon and logout button, around line 101), add a welcome display. Insert after the cart icon block and before the logout button:

```tsx
          {/* Business name — desktop only */}
          {businessName && (
            <span className="hidden md:block text-xs font-medium text-gray-500 max-w-[180px] truncate">
              {businessName}
            </span>
          )}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/(portal)/layout.tsx src/components/portal/NavBar.tsx
git commit -m "feat(ui): display client business name in portal navbar"
```

---

### Task 5: CartSidebar VAT Breakdown

**Files:**
- Modify: `src/components/portal/CartSidebar.tsx`

Currently the sidebar footer shows only "Subtotal" and "Total" with the same value (excl. VAT). We add VAT (15%) row and show a proper three-row breakdown.

The `subtotal()` from the cart store returns the excl-VAT sum. VAT = subtotal × 0.15. Total = subtotal + VAT.

- [ ] **Step 1: Add VAT constant and computed values**

In `src/components/portal/CartSidebar.tsx`, on line 15 after the `ZAR` formatter, add:
```tsx
const VAT_RATE = 0.15;
```

On line 16 inside the component function, after `const sub = subtotal();`, add:
```tsx
  const vat = parseFloat((sub * VAT_RATE).toFixed(2));
  const total = parseFloat((sub + vat).toFixed(2));
```

- [ ] **Step 2: Replace the footer rows**

Change the footer `space-y-2` block (lines 99–110):
```tsx
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-slate-900 font-medium">{ZAR.format(sub)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-base font-semibold text-slate-900">Total</span>
            <span className="text-base font-bold text-slate-900">
              {ZAR.format(sub)}
            </span>
          </div>
        </div>
```
to:
```tsx
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal (Excl. VAT)</span>
            <span className="text-slate-900 font-medium">{ZAR.format(sub)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">VAT (15%)</span>
            <span className="text-slate-900 font-medium">{ZAR.format(vat)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-base font-semibold text-slate-900">Total</span>
            <span className="text-base font-bold text-slate-900">
              {ZAR.format(total)}
            </span>
          </div>
        </div>
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/CartSidebar.tsx
git commit -m "feat(ui): add VAT (15%) row to cart sidebar summary"
```

---

### Task 6: Order History VAT Breakdown

**Files:**
- Modify: `src/app/(portal)/orders/page.tsx`
- Modify: `src/components/portal/OrderHistoryTable.tsx`

The `orders` table has `subtotal`, `vat_amount`, and `total_amount` columns. We just need to fetch and forward them. The table will show the three-row breakdown in the expanded accordion footer.

- [ ] **Step 1: Fetch subtotal and vat_amount in the orders page**

In `src/app/(portal)/orders/page.tsx`, change line 12's `.select()` call from:
```tsx
      `id, reference_number, created_at, total_amount, status,
       order_items ( id, sku, product_name, unit_price, quantity, line_total )`
```
to:
```tsx
      `id, reference_number, created_at, subtotal, vat_amount, total_amount, status,
       order_items ( id, sku, product_name, unit_price, quantity, line_total )`
```

- [ ] **Step 2: Add subtotal/vat_amount to the row mapping**

In `src/app/(portal)/orders/page.tsx`, change the `rows` mapping (line 33 block). The current mapped object is:
```tsx
  const rows = (orders ?? []).map((o: RawOrder) => ({
    id: o.id,
    reference_number: o.reference_number,
    created_at: o.created_at,
    total_amount: Number(o.total_amount),
    status: o.status,
    item_count: ((o.order_items as RawItem[]) ?? []).length,
    items: ((o.order_items as RawItem[]) ?? []).map((i) => ({
```
Change to:
```tsx
  const rows = (orders ?? []).map((o: RawOrder) => ({
    id: o.id,
    reference_number: o.reference_number,
    created_at: o.created_at,
    subtotal: Number(o.subtotal),
    vat_amount: Number(o.vat_amount),
    total_amount: Number(o.total_amount),
    status: o.status,
    item_count: ((o.order_items as RawItem[]) ?? []).length,
    items: ((o.order_items as RawItem[]) ?? []).map((i) => ({
```

- [ ] **Step 3: Add subtotal/vat_amount to OrderRow interface**

In `src/components/portal/OrderHistoryTable.tsx`, change the `OrderRow` interface (lines 43–51):
```tsx
interface OrderRow {
  id: string;
  reference_number: string;
  created_at: string;
  total_amount: number;
  status: string;
  item_count: number;
  items: OrderItem[];
}
```
to:
```tsx
interface OrderRow {
  id: string;
  reference_number: string;
  created_at: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  status: string;
  item_count: number;
  items: OrderItem[];
}
```

- [ ] **Step 4: Add the three-row financial summary to the expanded accordion**

In `src/components/portal/OrderHistoryTable.tsx`, the expanded accordion section starts at line 258. After the items list (after the closing `</div>` of the `bg-white border` div that wraps item rows), add a totals footer. The current accordion content (lines 258–293):

```tsx
            {/* Accordion — line items */}
            {isExpanded && (
              <div className="bg-gray-50 px-3 md:px-6 py-4 md:py-6">
                <div className="bg-white border border-gray-100 rounded shadow-sm divide-y divide-gray-50">
                  {/* ... headers and items ... */}
                </div>
              </div>
            )}
```

After the closing `</div>` of `bg-white border border-gray-100 rounded shadow-sm divide-y divide-gray-50`, add:

```tsx
                  {/* VAT totals footer */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-gray-100">
                    <div className="ml-auto max-w-xs space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal (Excl. VAT)</span>
                        <span className="font-medium text-slate-900">{ZAR.format(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">VAT (15%)</span>
                        <span className="font-medium text-slate-900">{ZAR.format(order.vat_amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="font-bold text-slate-900">{ZAR.format(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>
```

- [ ] **Step 5: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 6: Run tests**

```bash
npm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/(portal)/orders/page.tsx src/components/portal/OrderHistoryTable.tsx
git commit -m "feat(ui): show VAT breakdown (subtotal/VAT/total) in order history accordion"
```

---

### Task 7: Order History Accordion Visual Styling

**Files:**
- Modify: `src/components/portal/OrderHistoryTable.tsx`

The spec calls for a subtle background (`bg-slate-50` or `bg-blue-50`) on the expanded accordion to visually separate it from the rest of the page.

The current accordion wrapper (line 259) already uses `bg-gray-50`. We upgrade the inner item table container to use `bg-blue-50/40` and a blue-tinted border.

- [ ] **Step 1: Update the accordion container styling**

In `src/components/portal/OrderHistoryTable.tsx` line 260, change:
```tsx
                <div className="bg-white border border-gray-100 rounded shadow-sm divide-y divide-gray-50">
```
to:
```tsx
                <div className="bg-white border border-blue-100 rounded shadow-sm divide-y divide-gray-50">
```

And line 259, change the outer accordion wrapper:
```tsx
              <div className="bg-gray-50 px-3 md:px-6 py-4 md:py-6">
```
to:
```tsx
              <div className="bg-blue-50/30 px-3 md:px-6 py-4 md:py-6">
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/OrderHistoryTable.tsx
git commit -m "feat(ui): add blue-tinted background to order history expanded accordion"
```

---

### Task 8: Rename Catalogue Nav Link + Add /order-sheet Route

**Files:**
- Modify: `src/components/portal/NavBar.tsx`
- Create: `src/app/(portal)/order-sheet/page.tsx`

The current `/dashboard` route is the product ordering page. The nav link label "Catalogue" is misleading now that a real catalogue PDF page is coming. We rename the nav label to "Order Sheet" while keeping the `/dashboard` route intact. We also create `/order-sheet` as a redirect to `/dashboard` for any bookmarked URLs.

- [ ] **Step 1: Rename the nav label in NavBar**

In `src/components/portal/NavBar.tsx` lines 13–16:
```tsx
const BASE_NAV_LINKS: { href: Route; label: string }[] = [
  { href: "/dashboard", label: "Catalogue" },
  { href: "/orders", label: "Order History" },
];
```
Change to:
```tsx
const BASE_NAV_LINKS: { href: Route; label: string }[] = [
  { href: "/dashboard", label: "Order Sheet" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/orders", label: "Order History" },
];
```

- [ ] **Step 2: Create the /order-sheet redirect page**

Create `src/app/(portal)/order-sheet/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function OrderSheetPage() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add src/components/portal/NavBar.tsx src/app/(portal)/order-sheet/page.tsx
git commit -m "feat(nav): rename Catalogue link to Order Sheet, add Catalogue nav entry"
```

---

### Task 9: New /catalogue Page with PDF Embed

**Files:**
- Create: `src/app/(portal)/catalogue/page.tsx`

A dedicated page that embeds the product catalogue PDF. The PDF URL is read from the `NEXT_PUBLIC_CATALOGUE_PDF_URL` environment variable (set in `.env.local`). If the env var is not set, a clear placeholder is shown.

- [ ] **Step 1: Create the catalogue page**

Create `src/app/(portal)/catalogue/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CataloguePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const pdfUrl = process.env.NEXT_PUBLIC_CATALOGUE_PDF_URL ?? null;

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white">
      {pdfUrl ? (
        <object
          data={pdfUrl}
          type="application/pdf"
          className="flex-1 w-full border-0"
          style={{ height: "100%" }}
          aria-label="Product Catalogue PDF"
        >
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
            <p className="text-sm">Your browser cannot display PDFs inline.</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Download Catalogue PDF
            </a>
          </div>
        </object>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400">
          <p className="text-sm font-medium">Catalogue PDF not configured.</p>
          <p className="text-xs">Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_CATALOGUE_PDF_URL</code> in your environment.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add env var placeholder to .env.local (if it exists)**

Check whether `.env.local` exists. If it does, add:
```
NEXT_PUBLIC_CATALOGUE_PDF_URL=
```
at the end (with an empty value — the page handles the missing-URL case gracefully).

- [ ] **Step 3: Type-check**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -10
```
Expected: all pass — no server logic changed.

- [ ] **Step 5: Commit**

```bash
git add src/app/(portal)/catalogue/page.tsx
git commit -m "feat(catalogue): add /catalogue page with embedded PDF viewer"
```

---

## Self-Review

### Spec coverage

| Spec item | Task |
|-----------|------|
| Force light mode (`className="light"`, `colorScheme: light`) | T1 ✓ |
| Logo size increase | T2 ✓ |
| Replace chevron with "More Information" button | T3 ✓ |
| Navbar business_name display | T4 ✓ |
| CartSidebar 3-row VAT breakdown | T5 ✓ |
| Order history 3-row VAT breakdown | T6 ✓ |
| Order history accordion styling (`bg-blue-50`) | T7 ✓ |
| Rename nav label + route restructure | T8 ✓ |
| New /catalogue page with PDF embed | T9 ✓ |

### Placeholder scan

No TBDs. All code blocks are complete. No "similar to Task N" references.

### Type consistency

- `OrderRow.subtotal` and `OrderRow.vat_amount` added in T6 Step 3 match field names used in T6 Step 4.
- `NavBarProps.businessName` added in T4 Step 2 matches prop name passed in T4 Step 1.
- `VAT_RATE` constant in T5 matches the `0.15` value used in `CartReviewShell.tsx`.

### Notes for executor

- **Order of tasks matters for T8/T9**: Nav changes in T8 add `/catalogue` to the nav links; T9 creates the actual page. These must run in order.
- **No DB migrations needed**: `subtotal` and `vat_amount` already exist in the `orders` table (see `supabase/init.sql` lines 396–398).
- **PDF URL**: The client must provide the actual PDF URL. Set `NEXT_PUBLIC_CATALOGUE_PDF_URL=https://...` in `.env.local` and redeploy.
- **Phase 5 (n8n)**: Out of scope for this plan — it's infrastructure work, not portal code.
