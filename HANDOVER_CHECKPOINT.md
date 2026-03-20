# Handover Checkpoint — Enterprise Features Implementation

**Branch:** `feature/steel-matrix-prototype`
**Date:** 2026-03-18
**HEAD commit:** `c17fa84`

---

## Resume Instructions

> **For the next AI agent:** Read this document in full, then read the master implementation plan at `docs/superpowers/plans/2026-03-18-enterprise-features.md`. Tasks 1–8 are complete. Begin immediately with **Task 9 (Feature 2): Cart Discount Display + Checkout Integration**. Use the `superpowers:subagent-driven-development` skill — dispatch a fresh implementer subagent for Task 9, followed by spec compliance review, then code quality review. Do not skip any review stage.

---

## Current Task Status

| # | Task | Status |
|---|------|--------|
| 1 | SQL Migration (All Features) | ✅ Complete — `2d5abbf` |
| 2 | TypeScript Type Definitions (All Features) | ✅ Complete — `03770f6` |
| 3 | (F1) All Orders Start as Pending | ✅ Complete — `c848a10` |
| 4 | (F1) Cart Credit Warning UI | ⛔ **Cancelled** — client requirement: buyers must NOT see credit limits or warnings on the frontend cart. Do not touch `cart/page.tsx` or `CartReviewShell.tsx` for credit-related UI. |
| 5 | (F1) Admin Approve Order Action + UI | ✅ Complete — `654144c` |
| 6 | (F1) Admin Credit Management | ✅ Complete — `d5645f3` |
| 7 | (F2) Cart Store Discount Fields | ✅ Complete — `6f63ddf` |
| 8 | (F2) ProductDrawer + Product Admin Actions | ✅ Complete — `c17fa84` |
| 9 | (F2) Cart Discount Display + Checkout Integration | 🔲 **Next to implement** |
| 10 | (F3) Global Banner Admin Management | 🔲 Pending |
| 11 | (F3) GlobalBanner Component + Portal Integration | 🔲 Pending |

---

## Architecture State

### Database Schema Changes (migration: `supabase/migrations/20260318_enterprise_features.sql`)

**`profiles` table — added:**
```sql
available_credit NUMERIC(12,2) CHECK (available_credit >= 0)
```
Note: `credit_limit` already existed. `available_credit` is the current remaining balance; admins adjust it manually.

**`products` table — added:**
```sql
discount_type      TEXT CHECK (discount_type IN ('percentage', 'fixed'))
discount_threshold INT
discount_value     NUMERIC(10,2)
```

**`global_settings` table — new singleton:**
```sql
CREATE TABLE public.global_settings (
  id               INT PRIMARY KEY DEFAULT 1,
  banner_message   TEXT,
  is_banner_active BOOLEAN NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_settings_singleton CHECK (id = 1)
);
-- RLS: admins full access, authenticated users read-only
```

`supabase/init.sql` is also fully updated to match (including the singleton constraint rename on `tenant_config` → `CONSTRAINT tenant_config_singleton`).

---

### Files Modified (Tasks 1–8)

#### `src/lib/supabase/types.ts`
- `profiles` Row/Insert/Update: `available_credit: number | null` added
- `products` Row/Insert/Update: `discount_type`, `discount_threshold`, `discount_value` added
- New `global_settings` table type block added (Row/Insert/Update with singleton pattern)

#### `src/app/actions/checkout.ts`
- `initialStatus` is now always `"pending"` — removed the auto-confirm for 30-day buyers
- `confirmed_at` spread removed from order insert
- Divergent redirect (`/checkout/confirmed` for 30-day, `/checkout/payment` for EFT) is **unchanged**
- Note: checkout does NOT yet apply per-item discounts — this is Task 9's job

#### `src/app/actions/admin.ts`
Key additions (all server actions follow `requireAdmin()` guard pattern):
- `approveOrderAction` — transitions `pending` → `confirmed`; uses `.eq("status","pending")` guard + `.select("id")` to detect zero-rows-updated; no `revalidatePath` (mirrors `markProcessedAction` callback pattern)
- `createClientAction` / `updateClientAction` — both now parse and persist `available_credit`
- `createProductAction` / `updateProductAction` — both now parse and persist `discount_type`, `discount_threshold`, `discount_value` with cross-field validation

#### `src/lib/cart/store.ts`
- `CartItem` extended with optional `discountType?`, `discountThreshold?`, `discountValue?`
- New exported function: `getEffectiveUnitPrice(item: CartItem): number`
  - Returns `unitPrice` if no discount, type not set, threshold not met, or `discountValue` is null/non-finite
  - `percentage`: `Math.max(0, parseFloat((unitPrice * (1 - discountValue/100)).toFixed(2)))`
  - `fixed`: `Math.max(0, parseFloat((unitPrice - discountValue).toFixed(2)))`
  - Guards: `isFinite(discountValue)`, `discountThreshold > 0`
- `subtotal()` now uses `getEffectiveUnitPrice(i) * i.quantity`
- `addItem` refreshes discount metadata on re-add of an existing item

#### `src/components/admin/OrderLedger.tsx`
- `ExpandedRow` extended with `onApproved: (id: string) => void` prop
- Separate `[isApproving, startApprove]` transition for approve (does not share `isPending` with mark-processed)
- Sky-600 "Approve Order" button visible only when `order.status === "pending"`
- Parent `OrderLedger` has `handleApproved` callback updating status to `"confirmed"` optimistically

#### `src/components/admin/ClientDrawer.tsx`
- `ClientForDrawer` interface: `available_credit: number | null` added
- Form: standalone `<input type="number" name="available_credit">` field with helper text, placed after the credit_limit/payment_terms_days grid

#### `src/components/admin/ProductDrawer.tsx`
- `ProductForDrawer` interface: `discount_type`, `discount_threshold`, `discount_value` added
- Form: "Bulk Discount" section added before Stock Tracking section
  - `<Select name="discount_type">` with `"none"` / `"percentage"` / `"fixed"` options
  - 2-column grid: `<input name="discount_threshold" min={1}>` and `<input name="discount_value" min={0} step="0.01">`

#### `src/app/(admin)/admin/clients/page.tsx`
- `.select("*")` query already fetched `available_credit`
- `rows` mapping now includes: `available_credit: c.available_credit !== null ? Number(c.available_credit) : null`

#### `src/app/(admin)/admin/products/page.tsx`
- `.select()` query updated to explicitly include `discount_type, discount_threshold, discount_value`
- `rows` mapping includes all three with null-safe `Number()` coercion

---

## What Task 9 Needs to Do

Task 9 is the most complex remaining task. It wires the discount engine into the buyer-facing UI and the checkout server action. Key files:

- `src/app/(portal)/dashboard/page.tsx` — add `discount_type, discount_threshold, discount_value` to explicit `.select()` query and `rows` map
- `src/app/(portal)/dashboard/CatalogueShell.tsx` — extend `ProductRowData` interface with discount fields
- `src/components/portal/ProductRow.tsx` — extend `ProductRowProps`, pass discount fields to `addItem()`
- `src/components/portal/CartSidebar.tsx` — show per-item discount savings when applicable
- `src/app/(portal)/cart/CartReviewShell.tsx` — show per-item discount savings (**no credit limit UI** — Task 4 cancelled)
- `src/app/actions/checkout.ts` — extend `CartItemSchema` with discount fields, compute `effectiveUnitPrice` server-side using the same logic as `getEffectiveUnitPrice`

**Critical architectural note for Task 9 — checkout security:**
The server action must NOT trust client-supplied discount values. It should either:
1. Re-fetch discount rules from the DB for each `productId` and compute effective prices server-side, OR
2. At minimum, validate that the discount fields match what's stored in the DB before applying them

Option 1 is more secure. The plan specifies extending `CartItemSchema` with discount fields — follow the plan, but be aware this is a trust-client approach. If the plan is followed as written, the checkout computes effective price using passed-in discount metadata.

---

## Key Patterns to Follow

- **Server Actions return:** `{ error: string } | void` (or `| { id: string }` for creates)
- **No `revalidatePath` in:** `approveOrderAction`, `markProcessedAction` — use optimistic `onApproved`/`onMarked` callbacks instead
- **`adminClient`** (service role) used for all server-side DB mutations — bypasses RLS
- **Singleton table pattern:** `global_settings` uses `PRIMARY KEY DEFAULT 1` + `ON CONFLICT DO NOTHING`
- **`revalidatePath("/", "layout")`** — use this for the banner action to invalidate the entire portal layout

---

## Plan File Location

`docs/superpowers/plans/2026-03-18-enterprise-features.md`

Task 9 starts at approximately line 935 of the plan file.
