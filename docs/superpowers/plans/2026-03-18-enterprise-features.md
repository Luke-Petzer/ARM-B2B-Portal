# Enterprise Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three enterprise features to the B2B ordering portal — 30-day credit limits with admin-approval workflow, a dynamic bulk discount engine, and a global notification banner.

**Architecture:** Each feature adds a SQL migration, updates the hand-crafted TypeScript types, updates Server Actions in `src/app/actions/`, and modifies React components. No new external dependencies. All DB mutations go through Server Actions. Client-side cart state (Zustand) is extended with discount metadata; effective prices are computed dynamically from quantity thresholds.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), Tailwind CSS, TypeScript, Zustand, shadcn/ui (Sheet, Select)

> **Scope note:** These are three independent subsystems. For larger teams, split into three separate plans. For solo/small-team work, this combined sequential plan is fine.

---

## File Map

### New files to create

| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260318_enterprise_features.sql` | Additive DDL: `available_credit` on profiles, discount cols on products, `global_settings` table + RLS |
| `src/components/portal/GlobalBanner.tsx` | Server component: renders amber banner bar when active |
| `src/components/admin/GlobalBannerAdmin.tsx` | Client component: toggle + textarea form for banner management |
| `src/app/(admin)/admin/notifications/page.tsx` | Admin route: fetches banner state, renders GlobalBannerAdmin |

### Files to modify

| Path | What changes |
|------|--------------|
| `src/lib/supabase/types.ts` | Add `available_credit` to profiles; discount cols to products; add `global_settings` table type |
| `src/lib/cart/store.ts` | Add discount fields to `CartItem`; update `subtotal()` to use effective price; export `getEffectiveUnitPrice` |
| `src/app/actions/checkout.ts` | Remove auto-confirm for 30-day orders; apply per-item `discount_pct`; update Zod schema |
| `src/app/actions/admin.ts` | Add `approveOrderAction`, `adjustCreditAction`, `saveGlobalBannerAction`; extend product/client actions with new fields |
| `src/components/admin/OrderLedger.tsx` | Add "Approve Order" button visible only for `pending` orders |
| `src/components/admin/ClientDrawer.tsx` | Add `available_credit` input field |
| `src/components/admin/ProductDrawer.tsx` | Add discount type/threshold/value fields to form |
| `src/components/admin/AdminSidebar.tsx` | Add "Notifications" nav item to MAIN_NAV |
| `src/components/portal/CartSidebar.tsx` | Show per-item discount savings when applicable |
| `src/app/(portal)/cart/CartReviewShell.tsx` | Add credit warning UI; show per-item discount savings |
| `src/app/(portal)/cart/page.tsx` | Fetch `available_credit` from buyer profile; pass to CartReviewShell |
| `src/app/(portal)/dashboard/page.tsx` | Add discount cols to explicit `.select()` query; include in `rows` map |
| `src/app/(portal)/dashboard/CatalogueShell.tsx` | Extend `ProductRowData` interface with discount fields |
| `src/components/portal/ProductRow.tsx` | Extend `ProductRowProps`; pass discount fields to `addItem` |
| `src/app/(portal)/layout.tsx` | Fetch banner state; conditionally render GlobalBanner above children |

---

## Task 1: SQL Migration (All Features)

**Files:**
- Create: `supabase/migrations/20260318_enterprise_features.sql`
- Modify: `supabase/init.sql` (keep teardown/rebuild in sync)

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260318_enterprise_features.sql` with this content:

```sql
-- ============================================================
-- Migration: Enterprise Features (2026-03-18)
-- Feature 1: available_credit column on profiles
-- Feature 2: Discount columns on products
-- Feature 3: global_settings table for notification banner
-- Run in Supabase SQL Editor → New Query → Run
-- SAFE TO RE-RUN: uses IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- ── Feature 1: available_credit on profiles ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_credit NUMERIC(12,2)
    CHECK (available_credit IS NULL OR available_credit >= 0);

COMMENT ON COLUMN public.profiles.available_credit IS
  'Current credit balance available to this buyer. NULL = no limit tracked. Manually adjusted by admins.';

-- ── Feature 2: Bulk discount columns on products ─────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_type TEXT
    CHECK (discount_type IS NULL OR discount_type IN (''percentage'', ''fixed'')),
  ADD COLUMN IF NOT EXISTS discount_threshold INT
    CHECK (discount_threshold IS NULL OR discount_threshold > 0),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2)
    CHECK (discount_value IS NULL OR discount_value >= 0);

COMMENT ON COLUMN public.products.discount_type IS
  'Discount calculation method: ''percentage'' or ''fixed''. NULL = no bulk discount.';
COMMENT ON COLUMN public.products.discount_threshold IS
  'Minimum quantity required to trigger the bulk discount.';
COMMENT ON COLUMN public.products.discount_value IS
  'Discount amount: percentage points (0–100) or fixed ZAR deduction per unit, depending on discount_type.';

-- ── Feature 3: global_settings table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.global_settings (
  id               INT         PRIMARY KEY DEFAULT 1,
  banner_message   TEXT,
  is_banner_active BOOLEAN     NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT global_settings_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.global_settings IS
  'Singleton config row (id always = 1). Stores portal-wide notification banner state.';

-- Seed the singleton row
INSERT INTO public.global_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_global_settings" ON public.global_settings;
CREATE POLICY "admins_manage_global_settings"
  ON public.global_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated_read_global_settings" ON public.global_settings;
CREATE POLICY "authenticated_read_global_settings"
  ON public.global_settings
  FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste the file into Supabase SQL Editor → New Query → Run. Verify 0 errors.

Confirm with these checks:
```sql
-- Should return 1 row with available_credit column
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'available_credit';

-- Should return 3 rows
SELECT column_name FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('discount_type', 'discount_threshold', 'discount_value');

-- Should return 1 row with is_banner_active = false
SELECT * FROM public.global_settings;
```

- [ ] **Step 3: Update `supabase/init.sql` to match (teardown/rebuild hygiene)**

In `supabase/init.sql`, find the `profiles` table DDL (around line 207, after `credit_limit`). Add:
```sql
  available_credit    NUMERIC(12,2)   CHECK (available_credit IS NULL OR available_credit >= 0),
```

In `supabase/init.sql`, find the `products` table DDL (around line 317, after `is_active`). Add:
```sql
  -- Bulk discount engine
  discount_type       TEXT            CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  discount_threshold  INT             CHECK (discount_threshold IS NULL OR discount_threshold > 0),
  discount_value      NUMERIC(10,2)   CHECK (discount_value IS NULL OR discount_value >= 0),
```

In `supabase/init.sql`, after the `tenant_config` table + its INSERT, add the full `global_settings` block (CREATE TABLE + INSERT + RLS) from the migration above — but without the `IF NOT EXISTS` guards since init.sql does a full teardown first.

Also add `DROP TABLE IF EXISTS public.global_settings CASCADE;` to the Phase 0 teardown section (before the `profiles` drop, as it has no FK dependencies).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260318_enterprise_features.sql supabase/init.sql
git commit -m "feat(db): add available_credit, product discounts, and global_settings migration"
```

---

## Task 2: TypeScript Type Definitions (All Features)

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add `available_credit` to profiles Row/Insert/Update**

In `src/lib/supabase/types.ts`, find the `profiles` Row type (line ~120). After `credit_limit: number | null;` add:
```ts
          available_credit: number | null;
```

In `profiles` Insert (line ~141), after `credit_limit?: number | null;` add:
```ts
          available_credit?: number | null;
```

In `profiles` Update (line ~162), after `credit_limit?: number | null;` add:
```ts
          available_credit?: number | null;
```

- [ ] **Step 2: Add discount fields to products Row/Insert/Update**

In `products` Row (line ~285), after `tags: string[];` add:
```ts
          discount_type: "percentage" | "fixed" | null;
          discount_threshold: number | null;
          discount_value: number | null;
```

In `products` Insert (line ~300), after `tags?: string[];` add:
```ts
          discount_type?: "percentage" | "fixed" | null;
          discount_threshold?: number | null;
          discount_value?: number | null;
```

In `products` Update (line ~317), after `tags?: string[];` add:
```ts
          discount_type?: "percentage" | "fixed" | null;
          discount_threshold?: number | null;
          discount_value?: number | null;
```

- [ ] **Step 3: Add `global_settings` table type**

In `src/lib/supabase/types.ts`, find the closing `};` of the `Tables` block (after `audit_log`, around line 666). Before that closing `};`, add:

```ts
      // ----------------------------------------------------------------
      // global_settings — singleton notification banner config
      // ----------------------------------------------------------------
      global_settings: {
        Row: {
          id: number;
          banner_message: string | null;
          is_banner_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          banner_message?: string | null;
          is_banner_active?: boolean;
          updated_at?: string;
        };
        Update: {
          banner_message?: string | null;
          is_banner_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors. (Pre-existing type warnings are acceptable.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(types): add available_credit, discount fields, and global_settings types"
```

---

## Task 3 (Feature 1): All Orders Start as Pending

**Files:**
- Modify: `src/app/actions/checkout.ts`

Context: Line 195 currently reads `const initialStatus = is30Day ? ("confirmed" as const) : ("pending" as const);` — 30-day buyers auto-confirmed. New requirement: ALL orders start as `"pending"` and require admin approval.

- [ ] **Step 1: Remove the conditional `initialStatus` and the `confirmed_at` auto-set; update JSDoc**

**Update the JSDoc comment** at the top of `checkoutAction` (~line 152). Change the line:
```
 *   buyer_30_day   → /checkout/confirmed?orderId=... (auto-confirmed)
```
To:
```
 *   buyer_30_day   → /checkout/confirmed?orderId=... (pending admin approval)
```

In `src/app/actions/checkout.ts`, find lines ~193–196:
```ts
  const is30Day = session.role === "buyer_30_day";
  const paymentMethod = is30Day ? ("30_day_account" as const) : ("eft" as const);
  const initialStatus = is30Day ? ("confirmed" as const) : ("pending" as const);
  const now = new Date().toISOString();
```

Replace with:
```ts
  const is30Day = session.role === "buyer_30_day";
  const paymentMethod = is30Day ? ("30_day_account" as const) : ("eft" as const);
  const initialStatus = "pending" as const;
```

Then find the order `.insert({...})` block (~lines 200–211). Remove the `...(is30Day ? { confirmed_at: now } : {})` spread so the insert becomes:
```ts
  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .insert({
      profile_id: session.profileId,
      status: initialStatus,
      payment_method: paymentMethod,
      subtotal,
      discount_amount: 0,
      vat_amount: vatAmount,
      total_amount: totalAmount,
    })
    .select("*")
    .single();
```

**Keep the divergent redirect at lines 260–263 unchanged.** EFT buyers still go to `/checkout/payment` to upload proof. 30-day buyers still go to `/checkout/confirmed` — that page already works as a "order received" screen. The only change required is a copy update on that page to say "Your order is pending admin approval" instead of implying immediate confirmation. This is a low-priority UX note; do not block this task on it.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/checkout.ts
git commit -m "feat(checkout): all new orders start as pending — require admin approval"
```

---

## Task 4 (Feature 1): Cart Credit Warning

**Files:**
- Modify: `src/app/(portal)/cart/page.tsx`
- Modify: `src/app/(portal)/cart/CartReviewShell.tsx`

- [ ] **Step 1: Fetch `available_credit` in `CartPage`**

In `src/app/(portal)/cart/page.tsx`, after the `getSession()` call and the redirect guard, add:

```ts
  // Fetch buyer's available credit for 30-day account holders
  let availableCredit: number | null = null;
  if (session.role === "buyer_30_day") {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("available_credit")
      .eq("id", session.profileId)
      .single();
    availableCredit = profile?.available_credit ?? null;
  }
```

Then update the `<CartReviewShell>` JSX to pass the new prop:
```tsx
      <CartReviewShell
        reorderItems={reorderId ? reorderItems : null}
        availableCredit={availableCredit}
      />
```

- [ ] **Step 2: Update `CartReviewShellProps` in `CartReviewShell.tsx`**

Update the interface:
```ts
interface CartReviewShellProps {
  reorderItems: ReorderItem[] | null;
  availableCredit: number | null; // null = no credit limit tracked for this buyer
}
```

Update the destructured props in the function signature:
```ts
export default function CartReviewShell({ reorderItems, availableCredit }: CartReviewShellProps) {
```

- [ ] **Step 3: Add the credit warning UI to the Order Summary panel**

In `CartReviewShell.tsx`, find the Order Summary sticky card. After the `Final Total` row (around line 174) and before the `{error && ...}` block, insert:

```tsx
            {/* Credit limit warning — shown only when total exceeds available credit */}
            {availableCredit !== null && total > availableCredit && (
              <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                <div>
                  <p className="text-[13px] font-semibold text-amber-800">
                    Credit Limit Exceeded
                  </p>
                  <p className="text-[12px] text-amber-700 mt-0.5">
                    This order ({ZAR.format(total)}) exceeds your available credit (
                    {ZAR.format(availableCredit)}). Your order will be placed as{" "}
                    <strong>Pending</strong> and will require admin approval before
                    processing.
                  </p>
                </div>
              </div>
            )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(portal)/cart/page.tsx src/app/(portal)/cart/CartReviewShell.tsx
git commit -m "feat(cart): show credit limit warning when order total exceeds available_credit"
```

---

## Task 5 (Feature 1): Admin — Approve Order Action + UI

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/components/admin/OrderLedger.tsx`

- [ ] **Step 1: Add `approveOrderAction` to `admin.ts`**

In `src/app/actions/admin.ts`, directly after `markProcessedAction` (around line 48), add:

```ts
// ---------------------------------------------------------------------------
// approveOrderAction
// ---------------------------------------------------------------------------

/**
 * Transitions a pending order to "confirmed".
 * Does NOT call revalidatePath — mirrors markProcessedAction's pattern where
 * the calling client component handles the optimistic UI update via callback.
 * Guards against non-pending orders using an .eq("status", "pending") filter.
 */
export async function approveOrderAction(
  formData: FormData
): Promise<{ error: string } | void> {
  await requireAdmin();

  const orderId = formData.get("orderId") as string | null;
  if (!orderId) return { error: "Missing order ID." };

  const { error } = await adminClient
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending"); // guard: only transitions pending → confirmed

  if (error) {
    console.error("[admin] approveOrder:", error.message);
    return { error: "Failed to approve order. Please try again." };
  }
}
```

- [ ] **Step 2: Import `approveOrderAction` in `OrderLedger.tsx`**

In `src/components/admin/OrderLedger.tsx` (line 11), update the import:
```ts
import { markProcessedAction, approveOrderAction, exportOrdersCsvAction } from "@/app/actions/admin";
```

- [ ] **Step 3: Add `onApproved` callback to `ExpandedRow` and render the Approve button**

The existing `ExpandedRow` component signature is:
```ts
function ExpandedRow({ order, onMarked }: { order: OrderRow; onMarked: (id: string) => void; }) {
```

Extend it to:
```ts
function ExpandedRow({
  order,
  onMarked,
  onApproved,
}: {
  order: OrderRow;
  onMarked: (id: string) => void;
  onApproved: (id: string) => void;
}) {
```

Add a handler for approval alongside `handleMark`:
```ts
  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("orderId", order.id);
      const result = await approveOrderAction(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        onApproved(order.id);
      }
    });
  };
```

In the actions row (inside `<div className="flex items-center gap-3">`), add the Approve button **before** the existing Mark Processed button, conditional on `order.status === "pending"`:

```tsx
              {/* Approve Order — visible for pending orders only */}
              {order.status === "pending" && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="h-9 px-4 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve Order
                </button>
              )}
```

- [ ] **Step 4: Wire `onApproved` in the parent `OrderLedger` component**

In the main `OrderLedger` component, find where `<ExpandedRow>` is rendered (look for `onMarked` usage). The component uses local state (`orders`) to optimistically update status. Find the `setOrders` call pattern for `onMarked` and add the equivalent for `onApproved`:

```tsx
<ExpandedRow
  order={order}
  onMarked={(id) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "fulfilled" } : o))
    )
  }
  onApproved={(id) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "confirmed" } : o))
    )
  }
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/admin.ts src/components/admin/OrderLedger.tsx
git commit -m "feat(admin): add approveOrderAction and Approve button for pending orders"
```

---

## Task 6 (Feature 1): Admin — Credit Management

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/components/admin/ClientDrawer.tsx`

- [ ] **Step 1: Add `available_credit` to `updateClientAction` and `createClientAction` in `admin.ts`**

In `createClientAction` (around line 394), find:
```ts
  const creditLimit = parseFloat(formData.get("credit_limit") as string) || null;
```
Add below it:
```ts
  const availableCredit = formData.get("available_credit")
    ? parseFloat(formData.get("available_credit") as string)
    : null;
```

Add `available_credit: availableCredit` to the `.insert({...})` payload (line ~407).

In `updateClientAction` (around line 452), find:
```ts
  const creditLimit = parseFloat(formData.get("credit_limit") as string) || null;
```
Add below it:
```ts
  const rawAvailableCredit = formData.get("available_credit") as string | null;
  const availableCredit =
    rawAvailableCredit === "" || rawAvailableCredit === null
      ? null
      : parseFloat(rawAvailableCredit);
```

Add `available_credit: availableCredit` to the `.update({...})` payload (line ~464).

- [ ] **Step 2: Add `available_credit` field to `ClientDrawer.tsx`**

First, add `available_credit` to the `ClientForDrawer` interface:
```ts
  available_credit: number | null;
```

In the drawer form body, after the `credit_limit` `InputField` call, add:

```tsx
              <div>
                <FieldLabel>Available Credit (R)</FieldLabel>
                <input
                  type="number"
                  name="available_credit"
                  min={0}
                  step="0.01"
                  defaultValue={client?.available_credit ?? ""}
                  placeholder="e.g. 25000.00"
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Current available balance. Adjust manually to reflect payments received or credit resets.
                </p>
              </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/admin.ts src/components/admin/ClientDrawer.tsx
git commit -m "feat(admin): wire available_credit into client create/update actions and drawer UI"
```

---

## Task 7 (Feature 2): Cart Store — Discount Fields

**Files:**
- Modify: `src/lib/cart/store.ts`

- [ ] **Step 1: Extend `CartItem`, add `getEffectiveUnitPrice`, update `subtotal()`**

Replace the entire contents of `src/lib/cart/store.ts` with:

```ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number; // base/catalogue price — never mutated
  quantity: number;
  primaryImageUrl?: string | null;
  variantInfo?: { label: string; value: string } | null;
  // Bulk discount metadata (Feature 2) — set when item is added to cart
  discountType?: "percentage" | "fixed" | null;
  discountThreshold?: number | null;
  discountValue?: number | null;
}

/**
 * Returns the effective per-unit price after applying any bulk discount.
 * Returns `unitPrice` unchanged if no discount applies or threshold is not met.
 */
export function getEffectiveUnitPrice(item: CartItem): number {
  if (
    item.discountType &&
    item.discountValue != null &&
    item.discountThreshold != null &&
    item.quantity >= item.discountThreshold
  ) {
    if (item.discountType === "percentage") {
      return parseFloat(
        (item.unitPrice * (1 - item.discountValue / 100)).toFixed(2)
      );
    }
    if (item.discountType === "fixed") {
      return Math.max(
        0,
        parseFloat((item.unitPrice - item.discountValue).toFixed(2))
      );
    }
  }
  return item.unitPrice;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (incoming) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === incoming.productId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === incoming.productId
                  ? { ...i, quantity: i.quantity + (incoming.quantity ?? 1) }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...incoming, quantity: incoming.quantity ?? 1 },
            ],
          };
        });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }));
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      clearCart: () => set({ items: [] }),

      // Uses effective (post-discount) price per item
      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + getEffectiveUnitPrice(i) * i.quantity,
          0
        ),
    }),
    { name: "b2b-cart" }
  )
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cart/store.ts
git commit -m "feat(cart): add discount fields to CartItem and discount-aware subtotal"
```

---

## Task 8 (Feature 2): ProductDrawer + Product Admin Actions

**Files:**
- Modify: `src/components/admin/ProductDrawer.tsx`
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 1: Extend `ProductForDrawer` interface in `ProductDrawer.tsx`**

Update the `ProductForDrawer` interface (line ~26):
```ts
export interface ProductForDrawer {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  details: string | null;
  price: number;
  category_id: string | null;
  track_stock: boolean;
  stock_qty: number;
  is_active: boolean;
  primaryImageUrl: string | null;
  // Discount fields
  discount_type: "percentage" | "fixed" | null;
  discount_threshold: number | null;
  discount_value: number | null;
}
```

- [ ] **Step 2: Add bulk discount form section to `ProductDrawer.tsx`**

Inside the scrollable form body (`<div className="flex-1 overflow-y-auto p-6 space-y-6">`), add a new section **before** the Stock Tracking section (before the `<div className="space-y-3 pt-2 border-t border-slate-100">` stock block):

```tsx
            {/* Bulk Discount */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Bulk Discount
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Optional. Applied automatically when buyer meets the minimum quantity.
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Discount Type</FieldLabel>
                <Select
                  name="discount_type"
                  defaultValue={product?.discount_type ?? "none"}
                >
                  <SelectTrigger className="h-10 text-sm border-slate-200 focus:ring-slate-900/10 focus:border-slate-900">
                    <SelectValue placeholder="No discount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (R)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Min. Quantity</FieldLabel>
                  <input
                    type="number"
                    name="discount_threshold"
                    min={1}
                    step={1}
                    defaultValue={product?.discount_threshold ?? ""}
                    placeholder="e.g. 10"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Discount Value</FieldLabel>
                  <input
                    type="number"
                    name="discount_value"
                    min={0}
                    step="0.01"
                    defaultValue={product?.discount_value ?? ""}
                    placeholder="e.g. 15"
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                  />
                </div>
              </div>
            </div>
```

- [ ] **Step 3: Parse and persist discount fields in `createProductAction`**

In `src/app/actions/admin.ts`, inside `createProductAction`, after the `imageUrl` parse line (~line 238), add:

```ts
  const discountTypeRaw = (formData.get("discount_type") as string | null)?.trim();
  const discountType =
    !discountTypeRaw || discountTypeRaw === "none"
      ? null
      : (discountTypeRaw as "percentage" | "fixed");
  const discountThreshold = formData.get("discount_threshold")
    ? parseInt(formData.get("discount_threshold") as string, 10)
    : null;
  const discountValue = formData.get("discount_value")
    ? parseFloat(formData.get("discount_value") as string)
    : null;
```

Add to the `.insert({...})` payload (around line 246):
```ts
      discount_type: discountType,
      discount_threshold: discountThreshold,
      discount_value: discountValue,
```

- [ ] **Step 4: Parse and persist discount fields in `updateProductAction`**

In `updateProductAction`, after the `imageUrl` parse line (~line 303), add the same three parse lines as above.

Add to `updatePayload` (around line 311):
```ts
    discount_type: discountType,
    discount_threshold: discountThreshold,
    discount_value: discountValue,
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ProductDrawer.tsx src/app/actions/admin.ts
git commit -m "feat(admin): add bulk discount fields to ProductDrawer form and product actions"
```

---

## Task 9 (Feature 2): Cart Discount Display + Checkout Integration

**Files:**
- Modify: `src/components/portal/CartSidebar.tsx`
- Modify: `src/app/(portal)/cart/CartReviewShell.tsx`
- Modify: `src/app/actions/checkout.ts`
- Modify: `src/components/portal/ProductRow.tsx` (pass discount metadata on addItem)
- Check: `src/app/(portal)/dashboard/page.tsx` (ensure discount cols are selected)

- [ ] **Step 1: Add discount columns to `dashboard/page.tsx` select query**

In `src/app/(portal)/dashboard/page.tsx`, find the `.select(...)` call (line ~13):
```ts
    .select(
      `id, sku, name, description, price,
       product_images ( url, is_primary, display_order )`
    )
```

Replace with:
```ts
    .select(
      `id, sku, name, description, price,
       discount_type, discount_threshold, discount_value,
       product_images ( url, is_primary, display_order )`
    )
```

Then update the `rows` map (line ~34) to include the new fields:
```ts
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description as string | null,
      price: Number(p.price),
      primaryImageUrl: sorted[0]?.url ?? null,
      discountType: (p.discount_type as "percentage" | "fixed" | null) ?? null,
      discountThreshold: p.discount_threshold as number | null,
      discountValue: p.discount_value != null ? Number(p.discount_value) : null,
    };
```

- [ ] **Step 2: Extend `ProductRowData` in `CatalogueShell.tsx`**

In `src/app/(portal)/dashboard/CatalogueShell.tsx`, update the `ProductRowData` interface (line ~8):
```ts
interface ProductRowData {
  productId: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  primaryImageUrl: string | null;
  // Discount fields
  discountType: "percentage" | "fixed" | null;
  discountThreshold: number | null;
  discountValue: number | null;
}
```

No changes needed to the `filtered.map()` or `<ProductRow>` JSX — the spread `{...p}` already forwards all fields.

- [ ] **Step 3: Extend `ProductRowProps` in `ProductRow.tsx` and update `addItem` call**

In `src/components/portal/ProductRow.tsx`, update the `ProductRowProps` interface (line ~15):
```ts
interface ProductRowProps {
  productId: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  primaryImageUrl: string | null;
  // Discount metadata
  discountType: "percentage" | "fixed" | null;
  discountThreshold: number | null;
  discountValue: number | null;
}
```

Update the function signature destructuring:
```ts
export default function ProductRow({
  productId,
  sku,
  name,
  description,
  price,
  primaryImageUrl,
  discountType,
  discountThreshold,
  discountValue,
}: ProductRowProps) {
```

Update the `handleAdd` function (line ~35):
```ts
  const handleAdd = () => {
    addItem({
      productId,
      sku,
      name,
      unitPrice: price,
      quantity: qty,
      primaryImageUrl,
      discountType,
      discountThreshold,
      discountValue,
    });
  };
```

- [ ] **Step 3: Add discount savings display to `CartSidebar.tsx`**

At the top of `CartSidebar.tsx`, update the import:
```ts
import { useCartStore, getEffectiveUnitPrice } from "@/lib/cart/store";
```

In the per-item details block, find the `<div className="flex justify-between items-center">` that shows `Qty: {item.quantity}` and the line total. Replace it with:

```tsx
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-gray-500">
                  Qty: {item.quantity}
                </span>
                <div className="text-right">
                  <span className="text-[13px] font-medium text-slate-900">
                    {ZAR.format(getEffectiveUnitPrice(item) * item.quantity)}
                  </span>
                  {getEffectiveUnitPrice(item) < item.unitPrice && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Save{" "}
                      {ZAR.format(
                        (item.unitPrice - getEffectiveUnitPrice(item)) *
                          item.quantity
                      )}
                    </p>
                  )}
                </div>
              </div>
```

- [ ] **Step 4: Add discount display to `CartReviewShell.tsx`**

Import `getEffectiveUnitPrice` at the top of `CartReviewShell.tsx`:
```ts
import { useCartStore, getEffectiveUnitPrice } from "@/lib/cart/store";
```

In the items table, find the Line Total `<td>` (around line 124). Replace the content with:
```tsx
                    <td className="flex justify-between items-center md:table-cell px-6 py-2 md:py-5 text-sm font-medium text-slate-900 md:text-right align-middle">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider md:hidden">Line Total</span>
                      <div className="md:text-right">
                        <span>
                          {ZAR.format(
                            parseFloat(
                              (getEffectiveUnitPrice(item) * item.quantity).toFixed(2)
                            )
                          )}
                        </span>
                        {getEffectiveUnitPrice(item) < item.unitPrice && (
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">
                            Bulk discount applied
                          </p>
                        )}
                      </div>
                    </td>
```

In the Order Summary panel, after the `Subtotal` row, add a discount savings line:
```tsx
              {items.some((i) => getEffectiveUnitPrice(i) < i.unitPrice) && (
                <div className="flex justify-between items-center text-emerald-700">
                  <span className="text-sm">Bulk Discount Savings</span>
                  <span className="text-sm font-medium">
                    -
                    {ZAR.format(
                      items.reduce(
                        (acc, i) =>
                          acc +
                          (i.unitPrice - getEffectiveUnitPrice(i)) * i.quantity,
                        0
                      )
                    )}
                  </span>
                </div>
              )}
```

- [ ] **Step 5: Update `checkoutAction` Zod schema to accept discount fields**

In `src/app/actions/checkout.ts`, update `CartItemSchema`:
```ts
const CartItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  quantity: z.coerce.number().int().positive(),
  primaryImageUrl: z.string().nullable().optional(),
  variantInfo: z
    .object({ label: z.string(), value: z.string() })
    .nullable()
    .optional(),
  // Discount metadata
  discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
  discountThreshold: z.coerce.number().int().positive().nullable().optional(),
  discountValue: z.coerce.number().nonnegative().nullable().optional(),
});
```

- [ ] **Step 6: Add `computeItemDiscountPct` helper and update financials in `checkoutAction`**

Just above the `checkoutAction` export, add:
```ts
/** Computes the discount percentage (0–100) for a single cart item. */
function computeItemDiscountPct(
  item: z.infer<typeof CartItemSchema>
): number {
  if (
    !item.discountType ||
    item.discountValue == null ||
    item.discountThreshold == null ||
    item.quantity < item.discountThreshold
  )
    return 0;
  if (item.discountType === "percentage") return item.discountValue;
  // Fixed: convert ZAR amount to % of unit price
  return item.unitPrice > 0
    ? parseFloat(((item.discountValue / item.unitPrice) * 100).toFixed(4))
    : 0;
}
```

In the `checkoutAction` body, replace the financials block (step 4, around lines 187–190):

```ts
  // 4. Compute per-item discounts and financials
  const discountPcts = items.map(computeItemDiscountPct);
  const lineTotals = items.map((item, idx) =>
    r2(item.unitPrice * item.quantity * (1 - discountPcts[idx] / 100))
  );
  const subtotal = r2(lineTotals.reduce((s, lt) => s + lt, 0));
  const totalDiscountAmount = r2(
    items.reduce(
      (acc, item, idx) =>
        acc + r2(item.unitPrice * item.quantity * (discountPcts[idx] / 100)),
      0
    )
  );
  const vatAmount = r2(subtotal * vatRate);
  const totalAmount = r2(subtotal + vatAmount);
```

Update the order insert to use `totalDiscountAmount`:
```ts
      discount_amount: totalDiscountAmount,
```

Update `orderItemRows` to include `discount_pct`:
```ts
  const orderItemRows = items.map((item, idx) => ({
    order_id: order.id,
    product_id: item.productId,
    sku: item.sku,
    product_name: item.name,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    discount_pct: discountPcts[idx],
    line_total: lineTotals[idx],
    variant_info: item.variantInfo ?? null,
  }));
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/portal/CartSidebar.tsx \
        src/app/(portal)/cart/CartReviewShell.tsx \
        src/app/actions/checkout.ts \
        src/components/portal/ProductRow.tsx \
        src/app/(portal)/dashboard/CatalogueShell.tsx \
        src/app/(portal)/dashboard/page.tsx
git commit -m "feat(discount): wire discount display in cart UI and apply discount_pct in checkout"
```

---

## Task 10 (Feature 3): Global Banner Admin Management

**Files:**
- Modify: `src/app/actions/admin.ts`
- Create: `src/components/admin/GlobalBannerAdmin.tsx`
- Create: `src/app/(admin)/admin/notifications/page.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Add `saveGlobalBannerAction` to `admin.ts`**

After `updateTenantConfigAction`, add:

```ts
// ---------------------------------------------------------------------------
// saveGlobalBannerAction
// ---------------------------------------------------------------------------

/**
 * Upserts the global notification banner settings in the global_settings singleton.
 * Accessible to all admin roles (no super-admin lock required).
 */
export async function saveGlobalBannerAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const banner_message =
    (formData.get("banner_message") as string)?.trim() || null;
  const is_banner_active = formData.get("is_banner_active") === "true";

  const { error } = await adminClient
    .from("global_settings")
    .update({
      banner_message,
      is_banner_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    console.error("[admin] saveGlobalBanner:", error.message);
    return { error: "Failed to save banner settings. Please try again." };
  }

  revalidatePath("/admin/notifications");
  // Revalidate the portal layout so the banner updates across all buyer pages
  revalidatePath("/", "layout");

  return { success: true };
}
```

- [ ] **Step 2: Create `GlobalBannerAdmin.tsx`**

Create `src/components/admin/GlobalBannerAdmin.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2, Bell, BellOff } from "lucide-react";
import { saveGlobalBannerAction } from "@/app/actions/admin";

interface GlobalBannerAdminProps {
  initialMessage: string | null;
  initialActive: boolean;
}

export default function GlobalBannerAdmin({
  initialMessage,
  initialActive,
}: GlobalBannerAdminProps) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    const fd = new FormData();
    fd.set("banner_message", message);
    fd.set("is_banner_active", isActive ? "true" : "false");
    startTransition(async () => {
      const result = await saveGlobalBannerAction(fd);
      if ("error" in result) {
        setErrorMsg(result.error);
        setStatus("error");
      } else {
        setStatus("success");
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
          {isActive ? (
            <Bell className="w-5 h-5 text-amber-600" />
          ) : (
            <BellOff className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Notification Banner
          </h2>
          <p className="text-sm text-slate-500">
            Displays a message at the top of the portal for all signed-in buyers.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-900">Banner Active</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isActive
                ? "Banner is currently visible to buyers."
                : "Banner is hidden from buyers."}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        {/* Message textarea */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Banner Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="e.g. Our warehouse will be closed 24–26 December. Orders placed now will ship from 2 January."
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all resize-none"
          />
          <p className="text-[11px] text-slate-400">Plain text only.</p>
        </div>

        {/* Live preview */}
        {message && isActive && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 mr-2">
              Preview:
            </span>
            {message}
          </div>
        )}

        {/* Status feedback */}
        {status === "success" && (
          <p className="text-sm text-emerald-700 font-medium">
            Banner settings saved successfully.
          </p>
        )}
        {status === "error" && errorMsg && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-11 px-6 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Banner Settings"
          )}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create the notifications admin page**

Create `src/app/(admin)/admin/notifications/page.tsx`:

```tsx
import { adminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import GlobalBannerAdmin from "@/components/admin/GlobalBannerAdmin";
import type { Route } from "next";

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/admin/login" as Route);

  const { data: settings } = await adminClient
    .from("global_settings")
    .select("banner_message, is_banner_active")
    .eq("id", 1)
    .single();

  return (
    <div className="max-w-[700px]">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Notifications
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage portal-wide announcements displayed to all buyers.
        </p>
      </div>

      <GlobalBannerAdmin
        initialMessage={settings?.banner_message ?? null}
        initialActive={settings?.is_banner_active ?? false}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add "Notifications" to `AdminSidebar.tsx` MAIN_NAV**

In `src/components/admin/AdminSidebar.tsx`, add `Bell` to the lucide-react import (line 7):
```ts
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  FileText,
  Box,
  LogOut,
  Bell,
} from "lucide-react";
```

Add to `MAIN_NAV` array (after `Clients`):
```ts
  {
    href: "/admin/notifications" as Route,
    label: "Notifications",
    icon: <Bell className="w-[18px] h-[18px]" />,
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/admin.ts \
        src/components/admin/GlobalBannerAdmin.tsx \
        src/app/(admin)/admin/notifications/page.tsx \
        src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): add global notification banner management — admin page, form, and server action"
```

---

## Task 11 (Feature 3): GlobalBanner Component + Portal Integration

**Files:**
- Create: `src/components/portal/GlobalBanner.tsx`
- Modify: `src/app/(portal)/layout.tsx`

- [ ] **Step 1: Create `GlobalBanner.tsx`**

Create `src/components/portal/GlobalBanner.tsx`:

```tsx
interface GlobalBannerProps {
  message: string;
}

export default function GlobalBanner({ message }: GlobalBannerProps) {
  return (
    <div className="w-full bg-amber-500 text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-2.5 flex items-center justify-center gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <p className="text-sm font-medium text-center leading-snug">{message}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `(portal)/layout.tsx` to fetch banner state and render it**

Replace the current pass-through layout (`src/app/(portal)/layout.tsx`) with:

```tsx
import { adminClient } from "@/lib/supabase/admin";
import GlobalBanner from "@/components/portal/GlobalBanner";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch banner state — adminClient bypasses RLS; data is non-sensitive
  const { data: settings } = await adminClient
    .from("global_settings")
    .select("banner_message, is_banner_active")
    .eq("id", 1)
    .single();

  const showBanner =
    settings?.is_banner_active === true &&
    typeof settings.banner_message === "string" &&
    settings.banner_message.trim().length > 0;

  return (
    <>
      {showBanner && <GlobalBanner message={settings!.banner_message!} />}
      {children}
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 4: Full production build check**

```bash
npm run build
```
Expected: Build completes successfully. Pre-existing `<img>` warnings are acceptable; no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/GlobalBanner.tsx src/app/(portal)/layout.tsx
git commit -m "feat(banner): render global notification banner in portal layout"
```

---

## Final: Manual Smoke Test Checklist

Run `npm run dev` and verify all three features end-to-end:

**Feature 1 — Credit Limits & Pending Orders:**
- [ ] Place an order as a `buyer_30_day` account → order status in Supabase is `pending` (not `confirmed`)
- [ ] Admin → Command Center → find the pending order → "Approve Order" button visible → click it → status changes to `confirmed`
- [ ] Admin → Clients → open a buyer drawer → `Available Credit` field visible → set to `100` → Save
- [ ] Log in as that buyer, add items totalling > R100 → Cart Review page shows amber "Credit Limit Exceeded" warning above the checkout button
- [ ] Click "Proceed to Checkout" → order still submits successfully (warning is non-blocking)

**Feature 2 — Bulk Discount Engine:**
- [ ] Admin → Products → open any product → Bulk Discount section visible → set Type: Percentage, Min Qty: 5, Value: 10 → Save
- [ ] Buyer → Dashboard → add that product, qty 4 → CartSidebar shows no discount
- [ ] Increase to qty 5 → CartSidebar shows "Save R X.XX" and discounted line total
- [ ] Navigate to Cart Review → line total shows discounted amount + "Bulk discount applied" badge + "Bulk Discount Savings" summary line
- [ ] Proceed to checkout → in Supabase `order_items` table: `discount_pct = 10`, `line_total` matches the discounted calculation

**Feature 3 — Global Notification Banner:**
- [ ] Admin → Notifications (new sidebar item) → page loads with toggle + textarea
- [ ] Type a message → toggle ON → click "Save Banner Settings" → success message appears
- [ ] Visit `/dashboard` as a buyer → amber banner appears above the NavBar with the message
- [ ] Admin → Notifications → toggle OFF → Save
- [ ] Buyer refreshes `/dashboard` → banner is gone
