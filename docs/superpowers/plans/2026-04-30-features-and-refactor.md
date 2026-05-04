# Features & System Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement per-client custom pricing (two mechanisms), multiple delivery locations on the cart page, and auto-generated account numbers.

**Architecture:** Three independent features layered onto the existing Next.js 16 + Supabase stack. Item 4 (account numbers) is a pure DB migration. Item 3 (custom pricing) adds a new table + column, a server-side resolver function called at two injection points, and admin UI. Item 1 (delivery locations) adds a DeliveryAddressPicker component to the cart, modifies the checkout action to accept and snapshot an address, and updates `create_order_atomic`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (PostgreSQL + RLS), Tailwind CSS v3, Zustand v5, Vitest

**Spec:** `docs/superpowers/specs/2026-04-30-features-and-refactor-design.md`

---

## File Structure

### Item 4 — Account Numbers
| File | Action |
|------|--------|
| `supabase/migrations/20260430_01_account_number_sequence.sql` | Create — sequence + trigger update + backfill |

### Item 3 — Custom Pricing
| File | Action |
|------|--------|
| `supabase/migrations/20260430_02_client_custom_pricing.sql` | Create — new table + column + RLS + trigger |
| `src/lib/pricing/resolveClientPricing.ts` | Create — server-side price resolution function |
| `src/app/(portal)/dashboard/page.tsx` | Modify — call resolver after cache fetch |
| `src/app/actions/checkout.ts` | Modify — call resolver after product re-fetch |
| `src/app/actions/admin.ts` | Modify — add 4 custom pricing admin actions |
| `src/components/admin/ClientDrawer.tsx` | Modify — add Custom Pricing section in edit mode |
| `tests/audit/financial/resolve-client-pricing.test.ts` | Create — unit tests for resolver |
| `tests/audit/financial/pricing-integration.test.ts` | Create — integration tests for pricing pipeline with custom prices |

### Item 1 — Delivery Locations
| File | Action |
|------|--------|
| `supabase/migrations/20260430_03_order_shipping_address.sql` | Create — update `create_order_atomic` to include `shipping_address` |
| `src/components/portal/DeliveryAddressPicker.tsx` | Create — address picker component |
| `src/app/(portal)/cart/page.tsx` | Modify — fetch buyer's shipping addresses |
| `src/app/(portal)/cart/CartReviewShell.tsx` | Modify — accept addresses prop, render picker, pass addressId to checkout |
| `src/app/actions/addresses.ts` | Modify — return address ID, add label support |
| `src/app/actions/checkout.ts` | Modify — accept addressId, fetch/validate, snapshot on order |
| `tests/audit/cart/delivery-address-picker.test.ts` | Create — unit tests for address selection logic |

---

## Task 1: Auto-Generated Account Numbers (Item 4)

**Files:**
- Create: `supabase/migrations/20260430_01_account_number_sequence.sql`

This is a single SQL migration that creates a sequence, updates the existing `handle_new_buyer_user()` trigger to auto-assign `ARM-NNNNNN` format account numbers, and optionally backfills existing NULL accounts.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260430_01_account_number_sequence.sql`:

```sql
-- ============================================================
-- Migration: Auto-generated account numbers (2026-04-30)
-- Creates a PostgreSQL sequence and updates the buyer signup
-- trigger to auto-assign ARM-NNNNNN format account numbers.
-- ============================================================

-- 1. Create sequence for account numbers
CREATE SEQUENCE IF NOT EXISTS public.account_number_seq START 1;

-- 2. Update the trigger to auto-assign account numbers
CREATE OR REPLACE FUNCTION public.handle_new_buyer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only handle non-admin signups
  IF NEW.raw_user_meta_data ->> 'role' = 'admin' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    role,
    business_name,
    contact_name,
    email,
    account_number,
    is_active
  ) VALUES (
    NEW.id,
    NEW.id,
    'buyer_default',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'business_name', '')), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'contact_name'), ''), 'New Client'),
    NEW.email,
    'ARM-' || LPAD(nextval('account_number_seq')::text, 6, '0'),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Backfill existing NULL account numbers for Auth-registered buyers
UPDATE profiles
SET account_number = 'ARM-' || LPAD(nextval('account_number_seq')::text, 6, '0')
WHERE account_number IS NULL AND auth_user_id IS NOT NULL;
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP or local CLI:
```bash
# If using Supabase MCP:
mcp__supabase__apply_migration

# If using local CLI:
supabase db push
```

Expected: Migration applies successfully, sequence created, trigger updated, any NULL accounts backfilled.

- [ ] **Step 3: Verify the migration**

Run verification queries:
```sql
-- Verify sequence exists
SELECT * FROM pg_sequences WHERE sequencename = 'account_number_seq';

-- Verify no NULL account numbers remain for auth buyers
SELECT count(*) FROM profiles WHERE account_number IS NULL AND auth_user_id IS NOT NULL;
-- Expected: 0

-- Verify trigger function is updated (check for 'ARM-' in the function body)
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_buyer_user';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260430_01_account_number_sequence.sql
git commit -m "feat(accounts): auto-generate ARM-NNNNNN account numbers for new signups"
```

---

## Task 2: Custom Pricing — Schema Migration (Item 3, Part 1)

**Files:**
- Create: `supabase/migrations/20260430_02_client_custom_pricing.sql`

Creates the `client_custom_prices` table, adds `client_discount_pct` column to `profiles`, sets up RLS, and adds an `updated_at` trigger.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260430_02_client_custom_pricing.sql`:

```sql
-- ============================================================
-- Migration: Per-client custom pricing (2026-04-30)
-- Adds client_custom_prices table and client_discount_pct
-- column on profiles for two-mechanism custom pricing.
-- ============================================================

-- 1. New table: client_custom_prices
CREATE TABLE IF NOT EXISTS public.client_custom_prices (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price    NUMERIC(10,2) NOT NULL CHECK (custom_price >= 0),
  notes           TEXT,
  created_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, product_id)
);

-- 2. RLS policies
ALTER TABLE public.client_custom_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_access ON client_custom_prices FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY buyer_read_own ON client_custom_prices FOR SELECT
  TO authenticated USING (profile_id = auth.uid());

-- 3. Grant service_role full access (for adminClient usage)
GRANT ALL ON public.client_custom_prices TO service_role;

-- 4. Updated_at trigger (reuse existing pattern)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_custom_prices_updated_at
  BEFORE UPDATE ON public.client_custom_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Add client_discount_pct column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (client_discount_pct >= 0 AND client_discount_pct <= 100);

COMMENT ON COLUMN public.profiles.client_discount_pct IS
  'Blanket percentage discount for this client. Applied to all products unless overridden by client_custom_prices.';

-- 6. Index for fast lookups by profile_id
CREATE INDEX IF NOT EXISTS idx_client_custom_prices_profile_id
  ON public.client_custom_prices (profile_id);
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP or local CLI. Expected: table created, RLS policies active, column added.

- [ ] **Step 3: Verify the migration**

```sql
-- Verify table exists
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'client_custom_prices' ORDER BY ordinal_position;

-- Verify client_discount_pct column on profiles
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'client_discount_pct';

-- Verify RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'client_custom_prices';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260430_02_client_custom_pricing.sql
git commit -m "feat(pricing): add client_custom_prices table and client_discount_pct column"
```

---

## Task 3: Custom Pricing — Resolver Function (Item 3, Part 2)

**Files:**
- Create: `src/lib/pricing/resolveClientPricing.ts`
- Create: `tests/audit/financial/resolve-client-pricing.test.ts`

This is the core server-side function that resolves a buyer's custom prices. It's a pure function that takes profile data and product data and returns products with resolved prices.

- [ ] **Step 1: Write the failing tests**

Create `tests/audit/financial/resolve-client-pricing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveProductPrices,
  type CustomPriceEntry,
  type ProductWithPrice,
} from "../../../src/lib/pricing/resolveClientPricing";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(id: string, price: number): ProductWithPrice {
  return { id, price };
}

// ── resolveProductPrices ─────────────────────────────────────────────────────

describe("resolveProductPrices", () => {
  it("returns base price when no custom pricing exists", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 50)];
    const result = resolveProductPrices(products, [], 0);
    expect(result).toEqual([
      { id: "p1", price: 100 },
      { id: "p2", price: 50 },
    ]);
  });

  it("applies per-product custom price override", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 50)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p1", custom_price: 85 },
    ];
    const result = resolveProductPrices(products, customPrices, 0);
    expect(result).toEqual([
      { id: "p1", price: 85 },
      { id: "p2", price: 50 },
    ]);
  });

  it("applies client-level discount percentage to all products", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 200)];
    const result = resolveProductPrices(products, [], 5);
    expect(result).toEqual([
      { id: "p1", price: 95 },
      { id: "p2", price: 190 },
    ]);
  });

  it("per-product custom price takes priority over discount percentage", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 200)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p1", custom_price: 80 },
    ];
    // p1 gets custom price (80), p2 gets 5% off (190)
    const result = resolveProductPrices(products, customPrices, 5);
    expect(result).toEqual([
      { id: "p1", price: 80 },
      { id: "p2", price: 190 },
    ]);
  });

  it("handles zero discount percentage as no-op", () => {
    const products = [makeProduct("p1", 100)];
    const result = resolveProductPrices(products, [], 0);
    expect(result).toEqual([{ id: "p1", price: 100 }]);
  });

  it("rounds discount result to 2 decimal places", () => {
    const products = [makeProduct("p1", 99.99)];
    // 2.5% off 99.99 = 99.99 * 0.975 = 97.49025 → 97.49
    const result = resolveProductPrices(products, [], 2.5);
    expect(result).toEqual([{ id: "p1", price: 97.49 }]);
  });

  it("handles empty products array", () => {
    const result = resolveProductPrices([], [], 5);
    expect(result).toEqual([]);
  });

  it("ignores custom prices for products not in the array", () => {
    const products = [makeProduct("p1", 100)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p-not-in-list", custom_price: 50 },
    ];
    const result = resolveProductPrices(products, customPrices, 0);
    expect(result).toEqual([{ id: "p1", price: 100 }]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/audit/financial/resolve-client-pricing.test.ts
```

Expected: FAIL — module `resolveClientPricing` does not exist.

- [ ] **Step 3: Write the resolver implementation**

Create `src/lib/pricing/resolveClientPricing.ts`:

```typescript
// src/lib/pricing/resolveClientPricing.ts
// Pure price resolution function — no DB calls.
// Called by dashboard page and checkout action after fetching custom pricing data.

import { r2 } from "@/lib/checkout/pricing";

/** Minimal product shape needed for resolution */
export interface ProductWithPrice {
  id: string;
  price: number;
}

/** Shape of a row from client_custom_prices */
export interface CustomPriceEntry {
  product_id: string;
  custom_price: number;
}

/**
 * Resolves product prices for a specific client.
 *
 * Priority (highest to lowest):
 *   1. Per-product custom price (most specific)
 *   2. Client-level discount percentage (applies to all products without a custom price)
 *   3. Base product price (default)
 *
 * @param products       - Products with their base prices
 * @param customPrices   - Per-product custom price overrides for this client
 * @param discountPct    - Client-level blanket discount percentage (0-100)
 * @returns Products with resolved prices (same order, same shape)
 */
export function resolveProductPrices<T extends ProductWithPrice>(
  products: T[],
  customPrices: CustomPriceEntry[],
  discountPct: number
): T[] {
  const customMap = new Map(
    customPrices.map((cp) => [cp.product_id, Number(cp.custom_price)])
  );

  return products.map((product) => {
    const customPrice = customMap.get(product.id);
    if (customPrice !== undefined) {
      return { ...product, price: customPrice };
    }
    if (discountPct > 0) {
      return { ...product, price: r2(product.price * (1 - discountPct / 100)) };
    }
    return product;
  });
}

/**
 * Fetches custom pricing data from Supabase for a given profile.
 * Returns the data needed by resolveProductPrices.
 *
 * This is the only function that touches the DB — resolveProductPrices is pure.
 */
export async function fetchClientPricingData(
  adminClient: { from: (table: string) => unknown },
  profileId: string
): Promise<{ customPrices: CustomPriceEntry[]; discountPct: number }> {
  // Type the Supabase client calls properly
  const supabase = adminClient as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          then: (fn: (result: { data: unknown }) => void) => Promise<{ data: unknown }>;
        };
        single: () => { then: (fn: (result: { data: unknown }) => void) => Promise<{ data: unknown }> };
      };
    };
  };

  const [customPricesResult, profileResult] = await Promise.all([
    supabase
      .from("client_custom_prices")
      .select("product_id, custom_price")
      .eq("profile_id", profileId) as unknown as Promise<{ data: CustomPriceEntry[] | null }>,
    supabase
      .from("profiles")
      .select("client_discount_pct")
      .eq("id", profileId)
      .single() as unknown as Promise<{ data: { client_discount_pct: number } | null }>,
  ]);

  return {
    customPrices: (customPricesResult.data ?? []) as CustomPriceEntry[],
    discountPct: Number((profileResult.data as { client_discount_pct: number } | null)?.client_discount_pct ?? 0),
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/audit/financial/resolve-client-pricing.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/resolveClientPricing.ts tests/audit/financial/resolve-client-pricing.test.ts
git commit -m "feat(pricing): add resolveProductPrices pure function with tests"
```

---

## Task 4: Custom Pricing — Catalogue Injection Point (Item 3, Part 3)

**Files:**
- Modify: `src/app/(portal)/dashboard/page.tsx:42-93`

After the shared catalogue cache fetch, call the resolver with the authenticated buyer's profile to apply custom pricing. The cache is shared across all buyers, so resolution happens AFTER the cache, not inside it.

- [ ] **Step 1: Modify the dashboard page**

In `src/app/(portal)/dashboard/page.tsx`, add the import and call `fetchClientPricingData` + `resolveProductPrices` after the cache fetch, inside `DashboardPage()`:

```typescript
// Add at top of file:
import { fetchClientPricingData, resolveProductPrices } from "@/lib/pricing/resolveClientPricing";

// Inside DashboardPage(), after the rows mapping (after line 82), before categories mapping:
// Resolve custom pricing for this buyer (after cache, per-buyer)
const { customPrices, discountPct } = await fetchClientPricingData(
  adminClient,
  session.profileId
);
const resolvedRows = resolveProductPrices(rows, customPrices, discountPct);
```

Then pass `resolvedRows` instead of `rows` to `CatalogueShell`:

```tsx
return <CatalogueShell products={resolvedRows} categories={categories} />;
```

**Important:** The `rows` array already has `price: Number(p.price)` and `productId: p.id` (mapped as `id` won't work — the resolver expects `id`). We need to ensure the shape matches. The resolver uses `id` field, but `rows` uses `productId`. We'll adapt by passing a mapped array to the resolver and mapping back:

```typescript
// Map rows to resolver shape, resolve, then map back
const productsForResolver = rows.map((r) => ({ id: r.productId, price: r.price }));
const resolved = resolveProductPrices(productsForResolver, customPrices, discountPct);
const resolvedPriceMap = new Map(resolved.map((r) => [r.id, r.price]));
const resolvedRows = rows.map((r) => ({
  ...r,
  price: resolvedPriceMap.get(r.productId) ?? r.price,
}));
```

- [ ] **Step 2: Verify the build compiles**

```bash
npx next build 2>&1 | head -30
# Or: npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run existing test suite to check for regressions**

```bash
npx vitest run
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(portal\)/dashboard/page.tsx
git commit -m "feat(pricing): inject custom pricing resolution into catalogue fetch"
```

---

## Task 5: Custom Pricing — Checkout Injection Point (Item 3, Part 4)

**Files:**
- Modify: `src/app/actions/checkout.ts:238-335`

After re-fetching product prices from DB (line 242-249), call the resolver to apply custom pricing before computing line items. The `unit_price` snapshotted on `order_items` will be the resolved (possibly custom) price.

- [ ] **Step 1: Write the integration test**

Create `tests/audit/financial/pricing-integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveProductPrices, type CustomPriceEntry } from "../../../src/lib/pricing/resolveClientPricing";
import { computeLineItem, type DbProductPricing } from "../../../src/lib/checkout/pricing";

describe("pricing pipeline with custom prices", () => {
  it("custom price flows through to computeLineItem correctly", () => {
    // Product base price R100, custom price R85
    const products = [{ id: "p1", price: 100 }];
    const customPrices: CustomPriceEntry[] = [{ product_id: "p1", custom_price: 85 }];
    const resolved = resolveProductPrices(products, customPrices, 0);

    // Build DbProductPricing with the resolved price
    const dbProduct: DbProductPricing = {
      price: resolved[0].price,
      cost_price: 60,
      pack_size: 1,
      discount_type: null,
      discount_threshold: null,
      discount_value: null,
    };

    const lineItem = computeLineItem(dbProduct, 3);
    expect(lineItem.effectiveUnitPrice).toBe(85);
    expect(lineItem.lineTotal).toBe(255); // 85 * 3
  });

  it("custom price + bulk discount compound correctly", () => {
    // Custom price R90 (base R100), bulk discount 10% for 5+ units
    const products = [{ id: "p1", price: 100 }];
    const customPrices: CustomPriceEntry[] = [{ product_id: "p1", custom_price: 90 }];
    const resolved = resolveProductPrices(products, customPrices, 0);

    const dbProduct: DbProductPricing = {
      price: resolved[0].price, // 90
      cost_price: 60,
      pack_size: 1,
      discount_type: "percentage",
      discount_threshold: 5,
      discount_value: 10,
    };

    const lineItem = computeLineItem(dbProduct, 5);
    // R90 * 0.9 = R81/unit, R81 * 5 = R405
    expect(lineItem.effectiveUnitPrice).toBe(81);
    expect(lineItem.lineTotal).toBe(405);
  });

  it("client discount % + bulk discount compound correctly", () => {
    // Base R100, 5% client discount → R95, then bulk 10% for 5+ units
    const products = [{ id: "p1", price: 100 }];
    const resolved = resolveProductPrices(products, [], 5);

    const dbProduct: DbProductPricing = {
      price: resolved[0].price, // 95
      cost_price: 60,
      pack_size: 1,
      discount_type: "percentage",
      discount_threshold: 5,
      discount_value: 10,
    };

    const lineItem = computeLineItem(dbProduct, 5);
    // R95 * 0.9 = R85.50/unit, R85.50 * 5 = R427.50
    expect(lineItem.effectiveUnitPrice).toBe(85.5);
    expect(lineItem.lineTotal).toBe(427.5);
  });
});
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npx vitest run tests/audit/financial/pricing-integration.test.ts
```

Expected: All 3 tests PASS (these test the pure functions only — no server action mocking needed).

- [ ] **Step 3: Modify checkout.ts**

In `src/app/actions/checkout.ts`:

1. Add import at top:
```typescript
import { fetchClientPricingData, resolveProductPrices } from "@/lib/pricing/resolveClientPricing";
```

2. After the product map is built (after line 252 `const productMap = new Map(...)`) and before the line items computation (line 273), add:

```typescript
  // 4b. Resolve custom pricing for this buyer
  const { customPrices, discountPct } = await fetchClientPricingData(
    adminClient,
    session.profileId
  );

  // Apply custom pricing to the product map entries
  const productsForResolver = productRows.map((p) => ({
    id: p.id,
    price: Number(p.price),
  }));
  const resolvedPrices = resolveProductPrices(productsForResolver, customPrices, discountPct);
  const resolvedPriceMap = new Map(resolvedPrices.map((r) => [r.id, r.price]));
```

3. Modify the line items computation (line 273-276) to use resolved prices:

```typescript
  const lineItems = items.map((item) => {
    const dbProduct = productMap.get(item.productId)!;
    // Use the resolved price (custom or discounted) as the base for line item computation
    const resolvedPrice = resolvedPriceMap.get(item.productId) ?? Number(dbProduct.price);
    return computeLineItem({ ...dbProduct, price: resolvedPrice }, item.quantity);
  });
```

4. Modify `discountSavings` (line 279-282) to use resolved prices:

```typescript
  const discountSavings = items.map((item, idx) => {
    const resolvedPrice = resolvedPriceMap.get(item.productId) ?? Number(productMap.get(item.productId)!.price);
    return r2((resolvedPrice - lineItems[idx].effectiveUnitPrice) * item.quantity);
  });
```

5. Modify `orderItemPayloads` (line 327) to snapshot the resolved price:

```typescript
    unit_price: resolvedPriceMap.get(item.productId) ?? Number(dbProduct.price),  // resolved server-side price
```

- [ ] **Step 4: Verify compile + full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: No TypeScript errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/checkout.ts tests/audit/financial/pricing-integration.test.ts
git commit -m "feat(pricing): inject custom pricing into checkout action"
```

---

## Task 6: Custom Pricing — Admin Actions (Item 3, Part 5)

**Files:**
- Modify: `src/app/actions/admin.ts`

Add four server actions for managing custom prices and the client discount percentage.

- [ ] **Step 1: Add the admin actions**

Add at the end of `src/app/actions/admin.ts` (before the closing of the file), the following four actions:

```typescript
// ---------------------------------------------------------------------------
// Custom Pricing Actions
// ---------------------------------------------------------------------------

/**
 * Lists all custom prices for a given client.
 * Returns product details alongside the custom price for display in the admin drawer.
 */
export async function listClientCustomPricesAction(
  profileId: string
): Promise<{ error: string } | { data: { id: string; product_id: string; product_name: string; product_sku: string; base_price: number; custom_price: number; notes: string | null }[] }> {
  await requireAdmin();

  const idResult = z.string().min(1, "Profile ID required.").safeParse(profileId);
  if (!idResult.success) return { error: idResult.error.issues[0].message };

  const { data, error } = await adminClient
    .from("client_custom_prices")
    .select("id, product_id, custom_price, notes, products ( name, sku, price )")
    .eq("profile_id", idResult.data)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin] listClientCustomPrices:", error.message);
    return { error: "Failed to fetch custom prices." };
  }

  type RawRow = {
    id: string;
    product_id: string;
    custom_price: number;
    notes: string | null;
    products: { name: string; sku: string; price: number } | null;
  };

  return {
    data: ((data ?? []) as RawRow[]).map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.products?.name ?? "Unknown",
      product_sku: row.products?.sku ?? "",
      base_price: Number(row.products?.price ?? 0),
      custom_price: Number(row.custom_price),
      notes: row.notes,
    })),
  };
}

/**
 * Sets or updates a custom price for a specific product for a specific client.
 * Uses upsert (ON CONFLICT) so calling this for an existing product_id replaces the price.
 */
export async function setClientCustomPriceAction(
  profileId: string,
  productId: string,
  customPrice: number,
  notes?: string
): Promise<{ error: string } | { success: true }> {
  const session = await requireAdmin();

  // Validate inputs
  const profileIdResult = z.string().min(1).safeParse(profileId);
  const productIdResult = z.string().min(1).safeParse(productId);
  const priceResult = z.number().nonnegative("Price must be 0 or greater.").max(1e7, "Price too large.").safeParse(customPrice);

  if (!profileIdResult.success) return { error: "Invalid profile ID." };
  if (!productIdResult.success) return { error: "Invalid product ID." };
  if (!priceResult.success) return { error: priceResult.error.issues[0].message };

  const trimmedNotes = notes?.trim() || null;
  if (trimmedNotes && trimmedNotes.length > 500) return { error: "Notes too long (max 500 characters)." };

  const { error } = await adminClient
    .from("client_custom_prices")
    .upsert(
      {
        profile_id: profileIdResult.data,
        product_id: productIdResult.data,
        custom_price: priceResult.data,
        notes: trimmedNotes,
        created_by: session.profileId,
      },
      { onConflict: "profile_id,product_id" }
    );

  if (error) {
    console.error("[admin] setClientCustomPrice:", error.message);
    return { error: "Failed to set custom price." };
  }

  return { success: true };
}

/**
 * Removes a custom price for a specific product for a specific client.
 * After removal, the client will see the base price (or discount % if set).
 */
export async function removeClientCustomPriceAction(
  profileId: string,
  productId: string
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const { error } = await adminClient
    .from("client_custom_prices")
    .delete()
    .eq("profile_id", profileId)
    .eq("product_id", productId);

  if (error) {
    console.error("[admin] removeClientCustomPrice:", error.message);
    return { error: "Failed to remove custom price." };
  }

  return { success: true };
}

/**
 * Updates the client-level blanket discount percentage.
 * This applies to all products that don't have a per-product custom price.
 */
export async function updateClientDiscountPctAction(
  profileId: string,
  pct: number
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const pctResult = z.number().min(0).max(100, "Discount must be 0–100%.").safeParse(pct);
  if (!pctResult.success) return { error: pctResult.error.issues[0].message };

  const { error } = await adminClient
    .from("profiles")
    .update({
      client_discount_pct: pctResult.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    console.error("[admin] updateClientDiscountPct:", error.message);
    return { error: "Failed to update discount." };
  }

  revalidatePath("/admin/clients");
  return { success: true };
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "feat(pricing): add admin actions for custom pricing management"
```

---

## Task 7: Custom Pricing — Admin UI (Item 3, Part 6)

**Files:**
- Modify: `src/components/admin/ClientDrawer.tsx`

Add a "Custom Pricing" section to the edit mode of the ClientDrawer. This section shows:
1. A `client_discount_pct` input field
2. A product search to add per-product custom prices
3. A list of existing custom prices with remove buttons

- [ ] **Step 1: Add the Custom Pricing section to ClientDrawer**

In `src/components/admin/ClientDrawer.tsx`:

1. Add imports at top:
```typescript
import { Search, X } from "lucide-react";
import {
  listClientCustomPricesAction,
  setClientCustomPriceAction,
  removeClientCustomPriceAction,
  updateClientDiscountPctAction,
} from "@/app/actions/admin";
```

2. Add `client_discount_pct` to the `ClientForDrawer` interface:
```typescript
export interface ClientForDrawer {
  // ... existing fields ...
  client_discount_pct: number;
}
```

3. Inside the component (edit mode section), add state for custom pricing:
```typescript
const [discountPct, setDiscountPct] = useState<string>(
  String(client?.client_discount_pct ?? 0)
);
const [customPrices, setCustomPrices] = useState<{
  id: string; product_id: string; product_name: string; product_sku: string;
  base_price: number; custom_price: number; notes: string | null;
}[]>([]);
const [productSearch, setProductSearch] = useState("");
const [searchResults, setSearchResults] = useState<{ id: string; name: string; sku: string; price: number }[]>([]);
const [loadingPrices, setLoadingPrices] = useState(false);
```

4. Add a useEffect to load custom prices when drawer opens in edit mode:
```typescript
useEffect(() => {
  if (isEdit && client && open) {
    setLoadingPrices(true);
    listClientCustomPricesAction(client.id).then((result) => {
      if ("data" in result) setCustomPrices(result.data);
      setLoadingPrices(false);
    });
  }
}, [isEdit, client, open]);
```

5. Add the Custom Pricing section after the "Billing" section and before "Notes", inside the edit form:

```tsx
{/* Custom Pricing */}
<div className="space-y-4 pt-2 border-t border-slate-100">
  <div>
    <FieldLabel>Client Discount (%)</FieldLabel>
    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        max="100"
        step="0.5"
        value={discountPct}
        onChange={(e) => setDiscountPct(e.target.value)}
        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        placeholder="e.g. 5"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const val = parseFloat(discountPct);
          if (isNaN(val) || val < 0 || val > 100) return;
          startTransition(async () => {
            const result = await updateClientDiscountPctAction(client!.id, val);
            if (result && "error" in result) setError(result.error);
          });
        }}
        className="h-10 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap"
      >
        Save %
      </button>
    </div>
    <p className="text-[11px] text-slate-400 mt-1.5">
      Blanket discount applied to all products without a custom price.
    </p>
  </div>

  <div>
    <FieldLabel>Per-Product Custom Prices</FieldLabel>

    {/* Search for products */}
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
      <input
        type="text"
        value={productSearch}
        onChange={(e) => {
          setProductSearch(e.target.value);
          // Search will be debounced in implementation
        }}
        placeholder="Search by SKU or product name..."
        className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
      />
    </div>

    {/* Existing custom prices list */}
    {loadingPrices ? (
      <div className="text-xs text-slate-400 py-4 text-center">Loading custom prices...</div>
    ) : customPrices.length === 0 ? (
      <p className="text-xs text-slate-400 py-2">No custom prices set for this client.</p>
    ) : (
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {customPrices.map((cp) => (
          <div key={cp.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{cp.product_name}</p>
              <p className="text-[11px] text-slate-400">{cp.product_sku} · Base: R{cp.base_price.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm font-semibold text-slate-900">R{cp.custom_price.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeClientCustomPriceAction(client!.id, cp.product_id);
                    if (result && "success" in result) {
                      setCustomPrices((prev) => prev.filter((p) => p.id !== cp.id));
                    }
                  });
                }}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>
```

6. Add a product search handler with debounce and a results dropdown with price input. The product search calls `adminClient` to find products matching the query. When a product is selected, a price input appears. On confirming, it calls `setClientCustomPriceAction`.

**Note:** The product search needs a server action. Add to `admin.ts`:

```typescript
export async function searchProductsAction(
  query: string
): Promise<{ error: string } | { data: { id: string; name: string; sku: string; price: number }[] }> {
  await requireAdmin();
  if (!query.trim()) return { data: [] };

  const { data, error } = await adminClient
    .from("products")
    .select("id, name, sku, price")
    .eq("is_active", true)
    .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(10);

  if (error) return { error: "Search failed." };
  return {
    data: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
    })),
  };
}
```

- [ ] **Step 2: Update ClientsTable and admin clients page to pass `client_discount_pct`**

In `src/app/(admin)/admin/clients/page.tsx`, add `client_discount_pct` to the profiles query select.

In `src/app/(admin)/admin/clients/ClientsTable.tsx`, add `client_discount_pct` to the `ClientForDrawer` mapping.

- [ ] **Step 3: Verify compile + existing tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests pass.

- [ ] **Step 4: Test in browser**

Start the dev server and verify:
1. Open admin → Clients → Edit a client
2. See the "Custom Pricing" section with discount % field
3. Search for a product, set a custom price
4. Verify the custom price appears in the list
5. Remove a custom price
6. Set a discount percentage

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ClientDrawer.tsx src/app/actions/admin.ts \
  src/app/\(admin\)/admin/clients/page.tsx src/app/\(admin\)/admin/clients/ClientsTable.tsx
git commit -m "feat(pricing): add custom pricing admin UI to ClientDrawer"
```

---

## Task 8: Delivery Locations — Migration (Item 1, Part 1)

**Files:**
- Create: `supabase/migrations/20260430_03_order_shipping_address.sql`

Updates `create_order_atomic` to include `shipping_address` in the orders INSERT.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260430_03_order_shipping_address.sql`:

```sql
-- ============================================================
-- Migration: Add shipping_address to create_order_atomic (2026-04-30)
-- The orders.shipping_address JSONB column already exists but
-- was never populated. This migration updates the atomic order
-- creation function to accept and store the shipping address.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order  jsonb,
  p_items  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- [L10] Runtime caller-role guard
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_order_atomic: unauthorized caller role %', COALESCE(auth.role(), 'null')
      USING ERRCODE = '42501';
  END IF;

  -- 1. Insert order header (now includes shipping_address)
  INSERT INTO public.orders (
    profile_id,
    status,
    payment_method,
    subtotal,
    discount_amount,
    vat_amount,
    total_amount,
    order_notes,
    shipping_address
  )
  VALUES (
    (p_order->>'profile_id')::uuid,
    (p_order->>'status')::public.order_status,
    (p_order->>'payment_method')::public.payment_method,
    (p_order->>'subtotal')::numeric,
    (p_order->>'discount_amount')::numeric,
    (p_order->>'vat_amount')::numeric,
    (p_order->>'total_amount')::numeric,
    p_order->>'order_notes',
    CASE WHEN p_order->'shipping_address' IS NULL OR p_order->'shipping_address' = 'null'::jsonb
         THEN NULL
         ELSE p_order->'shipping_address'
    END
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert all line items in a single statement
  INSERT INTO public.order_items (
    order_id,
    product_id,
    sku,
    product_name,
    unit_price,
    cost_price,
    pack_size,
    quantity,
    discount_pct,
    line_total,
    variant_info
  )
  SELECT
    v_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    item->>'sku',
    item->>'product_name',
    (item->>'unit_price')::numeric,
    CASE WHEN (item->>'cost_price') IS NULL
         THEN NULL
         ELSE (item->>'cost_price')::numeric
    END,
    (item->>'pack_size')::integer,
    (item->>'quantity')::integer,
    (item->>'discount_pct')::numeric,
    (item->>'line_total')::numeric,
    NULLIF(item->'variant_info', 'null'::jsonb)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$;

-- Re-assert grants
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb, jsonb) TO service_role;
```

- [ ] **Step 2: Apply and verify**

Apply the migration. Verify:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'create_order_atomic';
-- Should contain 'shipping_address' in the INSERT
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260430_03_order_shipping_address.sql
git commit -m "feat(checkout): update create_order_atomic to store shipping_address"
```

---

## Task 9: Delivery Locations — Address Actions Update (Item 1, Part 2)

**Files:**
- Modify: `src/app/actions/addresses.ts`

Update `saveAddressAction` to return the new address ID and accept an optional label.

- [ ] **Step 1: Update saveAddressAction**

Modify `src/app/actions/addresses.ts`:

```typescript
"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";

// [L4] Max-length caps on address fields
const addressSchema = z.object({
  label: z.string().trim().max(100).optional(),
  line1: z.string().trim().min(1, "Street address is required").max(200),
  line2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  province: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).default("South Africa"),
});

export async function saveAddressAction(
  formData: FormData
): Promise<{ error: string } | { success: true; addressId: string }> {
  const session = await getSession();
  if (!session || !session.isBuyer) return { error: "Unauthorized" };

  const parsed = addressSchema.safeParse({
    label: formData.get("label") || undefined,
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    suburb: formData.get("suburb") || undefined,
    city: formData.get("city"),
    province: formData.get("province") || undefined,
    postal_code: formData.get("postal_code") || undefined,
    country: formData.get("country") || "South Africa",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data: newAddress, error } = await adminClient
    .from("addresses")
    .insert({
      profile_id: session.profileId,
      type: "shipping",
      is_default: true,
      ...parsed.data,
    })
    .select("id")
    .single();

  if (error) return { error: "Failed to save address. Please try again." };
  return { success: true, addressId: newAddress.id };
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/addresses.ts
git commit -m "feat(addresses): return address ID and support optional label"
```

---

## Task 10: Delivery Locations — DeliveryAddressPicker Component (Item 1, Part 3)

**Files:**
- Create: `src/components/portal/DeliveryAddressPicker.tsx`

A compact address display/selection component inspired by Takealot. Shows collapsed state with the selected address, expands to show all addresses with radio selection, and includes an inline form for adding new addresses.

- [ ] **Step 1: Create the DeliveryAddressPicker component**

Create `src/components/portal/DeliveryAddressPicker.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { MapPin, ChevronDown, Plus } from "lucide-react";
import AddressGateForm from "@/components/auth/AddressGateForm";

export interface ShippingAddress {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  suburb: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
}

interface DeliveryAddressPickerProps {
  addresses: ShippingAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddressAdded: (id: string) => void;
}

function formatAddress(addr: ShippingAddress): string {
  const parts = [addr.line1, addr.line2, addr.suburb, addr.city, addr.postal_code].filter(Boolean);
  return parts.join(", ");
}

export default function DeliveryAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onAddressAdded,
}: DeliveryAddressPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const selected = addresses.find((a) => a.id === selectedId) ?? addresses[0] ?? null;

  if (!selected && addresses.length === 0) {
    // No addresses at all — show the add form directly
    return (
      <div className="bg-white border border-gray-100 rounded-lg p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Delivery Address</h3>
        </div>
        <AddressGateForm
          onSaved={() => {
            // The parent will refetch addresses via router.refresh()
            onAddressAdded("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm mb-4">
      {/* Collapsed state */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between p-4 text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Delivery Address
            </p>
            {selected && (
              <>
                {selected.label && (
                  <p className="text-sm font-medium text-slate-900">{selected.label}</p>
                )}
                <p className="text-sm text-slate-600 truncate">
                  {formatAddress(selected)}
                </p>
              </>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-primary flex items-center gap-1 flex-shrink-0 mt-0.5">
          {expanded ? "Close" : "Change"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* Expanded state */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                addr.id === selectedId
                  ? "border-primary bg-primary/5"
                  : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="delivery_address"
                value={addr.id}
                checked={addr.id === selectedId}
                onChange={() => {
                  onSelect(addr.id);
                  setExpanded(false);
                }}
                className="mt-0.5 accent-primary"
              />
              <div className="min-w-0">
                {addr.label && (
                  <p className="text-sm font-medium text-slate-900">{addr.label}</p>
                )}
                <p className="text-sm text-slate-600">{formatAddress(addr)}</p>
              </div>
            </label>
          ))}

          {/* Add new address option */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 w-full p-3 rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add new address
            </button>
          ) : (
            <div className="pt-2">
              <AddressGateForm
                onSaved={() => {
                  setShowAddForm(false);
                  setExpanded(false);
                  onAddressAdded("");
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/portal/DeliveryAddressPicker.tsx
git commit -m "feat(checkout): add DeliveryAddressPicker component"
```

---

## Task 11: Delivery Locations — Wire Into Cart Page (Item 1, Part 4)

**Files:**
- Modify: `src/app/(portal)/cart/page.tsx`
- Modify: `src/app/(portal)/cart/CartReviewShell.tsx`
- Modify: `src/app/actions/checkout.ts`

Wire the DeliveryAddressPicker into the cart page. The server component fetches addresses, the client component manages selection, and checkout action accepts + snapshots the address.

- [ ] **Step 1: Modify cart/page.tsx to fetch addresses**

In `src/app/(portal)/cart/page.tsx`, add address fetching:

```typescript
// After the reorder items fetch, add:
const { data: shippingAddresses } = await adminClient
  .from("addresses")
  .select("id, label, line1, line2, suburb, city, province, postal_code, is_default")
  .eq("profile_id", session.profileId)
  .eq("type", "shipping")
  .order("is_default", { ascending: false });
```

Pass to CartReviewShell:
```tsx
<CartReviewShell
  reorderItems={reorderId ? reorderItems : null}
  shippingAddresses={shippingAddresses ?? []}
/>
```

- [ ] **Step 2: Modify CartReviewShell to accept and render addresses**

In `src/app/(portal)/cart/CartReviewShell.tsx`:

1. Add imports:
```typescript
import DeliveryAddressPicker, { type ShippingAddress } from "@/components/portal/DeliveryAddressPicker";
import { useRouter } from "next/navigation";
```

2. Update props interface:
```typescript
interface CartReviewShellProps {
  reorderItems: ReorderItem[] | null;
  shippingAddresses: ShippingAddress[];
}
```

3. Add state for selected address:
```typescript
const router = useRouter();
const defaultAddr = shippingAddresses.find((a) => a.is_default) ?? shippingAddresses[0] ?? null;
const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddr?.id ?? null);
```

4. Add the DeliveryAddressPicker in the right column (lg:col-span-4), ABOVE the Order Summary:
```tsx
{/* Delivery Address Picker */}
<DeliveryAddressPicker
  addresses={shippingAddresses}
  selectedId={selectedAddressId}
  onSelect={setSelectedAddressId}
  onAddressAdded={() => router.refresh()}
/>
```

5. Update the checkout call to pass the selected address:
```typescript
const result = await checkoutAction(items, orderNotes, undefined, selectedAddressId);
```

6. Remove the `addressRequired` state and `AddressGateForm` usage (the picker now handles this).

- [ ] **Step 3: Modify checkout.ts to accept and snapshot address**

In `src/app/actions/checkout.ts`:

1. Update signature:
```typescript
export async function checkoutAction(
  rawItems: unknown,
  orderNotes: string = "",
  clientSubmissionId?: string,
  addressId?: string | null
): Promise<{ error: string } | void> {
```

2. Replace the existing address check (lines 204-215) with address fetch + validation:
```typescript
  // Fetch and validate the selected shipping address
  let shippingAddressSnapshot: Record<string, unknown> | null = null;

  if (session.isBuyer) {
    if (!addressId) {
      // Check if buyer has any address at all
      const { data: anyAddress } = await adminClient
        .from("addresses")
        .select("id")
        .eq("profile_id", session.profileId)
        .eq("type", "shipping")
        .limit(1);

      if (!anyAddress || anyAddress.length === 0) {
        return { error: "address_required" };
      }
      // Use default address if none selected
      const { data: defaultAddress } = await adminClient
        .from("addresses")
        .select("id, label, line1, line2, suburb, city, province, postal_code, country")
        .eq("profile_id", session.profileId)
        .eq("type", "shipping")
        .eq("is_default", true)
        .single();

      if (defaultAddress) {
        addressId = defaultAddress.id;
        shippingAddressSnapshot = {
          label: defaultAddress.label,
          line1: defaultAddress.line1,
          line2: defaultAddress.line2,
          suburb: defaultAddress.suburb,
          city: defaultAddress.city,
          province: defaultAddress.province,
          postal_code: defaultAddress.postal_code,
          country: defaultAddress.country,
        };
      }
    } else {
      // Validate ownership and fetch the selected address
      const { data: selectedAddress } = await adminClient
        .from("addresses")
        .select("id, label, line1, line2, suburb, city, province, postal_code, country")
        .eq("id", addressId)
        .eq("profile_id", session.profileId)
        .eq("type", "shipping")
        .single();

      if (!selectedAddress) {
        return { error: "Selected delivery address not found. Please choose another." };
      }

      shippingAddressSnapshot = {
        label: selectedAddress.label,
        line1: selectedAddress.line1,
        line2: selectedAddress.line2,
        suburb: selectedAddress.suburb,
        city: selectedAddress.city,
        province: selectedAddress.province,
        postal_code: selectedAddress.postal_code,
        country: selectedAddress.country,
      };
    }
  }
```

3. Pass the snapshot to `create_order_atomic` (in the `p_order` object):
```typescript
  p_order: {
    profile_id: session.profileId,
    status: initialStatus,
    payment_method: paymentMethod,
    subtotal,
    discount_amount: totalDiscountAmount,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    order_notes: trimmedNotes,
    shipping_address: shippingAddressSnapshot,
  },
```

- [ ] **Step 4: Verify compile + full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: No errors, all tests pass.

- [ ] **Step 5: Test in browser**

Start the dev server and verify:
1. Navigate to cart page with items
2. See the DeliveryAddressPicker above Order Summary
3. If buyer has addresses: see selected address, click "Change" to see all
4. Select a different address, verify it collapses
5. Click "Add new address", fill form, verify new address is added
6. Complete checkout, verify order has `shipping_address` populated

- [ ] **Step 6: Commit**

```bash
git add src/app/\(portal\)/cart/page.tsx src/app/\(portal\)/cart/CartReviewShell.tsx \
  src/app/actions/checkout.ts
git commit -m "feat(checkout): wire DeliveryAddressPicker into cart and snapshot address on order"
```

---

## Task 12: AddressGateForm Update for Label Support (Item 1, Part 5)

**Files:**
- Modify: `src/components/auth/AddressGateForm.tsx`

Add an optional label field to the AddressGateForm so new addresses can have a label. Also update the form to return the new address ID via the `onSaved` callback.

- [ ] **Step 1: Update AddressGateForm**

In `src/components/auth/AddressGateForm.tsx`:

1. Add `label` to the schema:
```typescript
const schema = z.object({
  label: z.string().max(100).optional(),
  line1: z.string().min(1, "Street address is required"),
  // ... rest unchanged
});
```

2. Update the `onSaved` callback type:
```typescript
interface AddressGateFormProps {
  onSaved: (addressId?: string) => void;
}
```

3. Add the label field to the form (first field, above line1):
```tsx
<div>
  <Label htmlFor="label" className="text-xs">Label (optional)</Label>
  <Input id="label" placeholder="e.g. Main Office, Warehouse" {...register("label")} />
</div>
```

4. Update onSubmit to pass `label` in FormData and pass the returned addressId:
```typescript
function onSubmit(data: FormValues) {
  setServerError(null);
  startTransition(async () => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v) fd.set(k, v); });
    const result = await saveAddressAction(fd);
    if ("error" in result) {
      setServerError(result.error);
    } else {
      onSaved(result.addressId);
    }
  });
}
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/AddressGateForm.tsx
git commit -m "feat(addresses): add optional label field and return addressId from AddressGateForm"
```

---

## Implementation Order Summary

| Order | Task | Item | Risk | Est. Files |
|-------|------|------|------|------------|
| 1 | Task 1: Account number sequence + trigger | Item 4 | Zero | 1 SQL |
| 2 | Task 2: Custom pricing schema migration | Item 3 | Low | 1 SQL |
| 3 | Task 3: Price resolver function + tests | Item 3 | Low | 2 TS |
| 4 | Task 4: Catalogue injection point | Item 3 | Medium | 1 TS |
| 5 | Task 5: Checkout injection point + tests | Item 3 | Medium | 2 TS |
| 6 | Task 6: Admin pricing actions | Item 3 | Low | 1 TS |
| 7 | Task 7: Admin pricing UI | Item 3 | Medium | 3 TS |
| 8 | Task 8: Shipping address migration | Item 1 | Low | 1 SQL |
| 9 | Task 9: Address action update | Item 1 | Low | 1 TS |
| 10 | Task 10: DeliveryAddressPicker component | Item 1 | Low | 1 TS |
| 11 | Task 11: Wire picker into cart + checkout | Item 1 | Medium | 3 TS |
| 12 | Task 12: AddressGateForm label support | Item 1 | Low | 1 TS |
