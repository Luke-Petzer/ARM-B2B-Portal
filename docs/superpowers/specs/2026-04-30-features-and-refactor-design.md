# Features & System Refactor — Design Spec

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Three features: per-client custom pricing (Item 3), multiple delivery locations (Item 1), auto-generated account numbers (Item 4)

---

## Table of Contents

1. [Item 3 — Per-Client Custom Pricing](#item-3--per-client-custom-pricing)
2. [Item 1 — Multiple Delivery Locations](#item-1--multiple-delivery-locations)
3. [Item 4 — Auto-Generated Account Numbers](#item-4--auto-generated-account-numbers)

---

## Item 3 — Per-Client Custom Pricing

### Problem

The system has a single base price per product. The client needs the ability to set custom prices for specific products for specific clients (30-day account holders initially, extensible to all users later). Additionally, the client wants to offer blanket percentage discounts (2.5-5%) to incentivise buyers onto the platform.

### Current pricing architecture

**Database:**
- `products.price` — single base price per product (NUMERIC 10,2)
- `products.discount_type/threshold/value` — bulk discount rules (buy X+ get Y% off)
- `order_items.unit_price` — snapshotted at checkout time, immutable after order creation

**Pricing pipeline:**
- `src/lib/checkout/pricing.ts` — pure functions: `computeEffectiveUnitPrice()`, `computeLineItem()`, `computeOrderTotals()`. Accept a `DbProductPricing` interface, never touch DB directly.
- `src/app/actions/checkout.ts:239-249` — re-fetches product prices from DB at checkout, discards client-supplied `unitPrice` entirely. Security invariant.
- `src/app/(portal)/dashboard/page.tsx:12-40` — cached catalogue fetch via `unstable_cache` with 5-min revalidation. Returns base prices to all buyers identically.
- `src/lib/cart/store.ts` — client-side Zustand store with `getEffectiveUnitPrice()` for display-only calculations.

**Key security invariant:** Client-supplied prices are NEVER used in calculations. All pricing is resolved server-side from the DB at checkout time.

### Two pricing mechanisms

| Mechanism | Scope | Example | Storage |
|-----------|-------|---------|---------|
| **Per-product custom price** | One client + one product | Item A is R45 for Client 1 (base is R50) | `client_custom_prices` table |
| **Client-level discount %** | One client + ALL products | Client 2 gets 5% off everything | `client_discount_pct` column on `profiles` |

**Override priority (highest to lowest):**
1. Per-product custom price (most specific, always wins)
2. Client-level discount % (applies to products without a custom price)
3. Base product price (default)

**Bulk discount interaction:** Bulk discounts (`discount_type/threshold/value`) still apply on top of the resolved price. If a product's base is R100, a client has a custom price of R90, and there's a bulk discount of 10% for 5+ units, then ordering 5 units gives: R90 × 0.9 = R81/unit. This matches how bulk discounts work today — they're computed in `computeEffectiveUnitPrice()` from whatever `price` is passed in.

### Schema changes

#### New table: `client_custom_prices`

```sql
CREATE TABLE public.client_custom_prices (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price    NUMERIC(10,2) NOT NULL CHECK (custom_price >= 0),
  notes           TEXT,
  created_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, product_id)
);

-- RLS: admins full access, buyers can read their own
ALTER TABLE public.client_custom_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full ON client_custom_prices FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY buyer_read_own ON client_custom_prices FOR SELECT
  TO authenticated USING (profile_id = auth.uid());
```

#### New column on profiles: `client_discount_pct`

```sql
ALTER TABLE public.profiles
  ADD COLUMN client_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (client_discount_pct >= 0 AND client_discount_pct <= 100);

COMMENT ON COLUMN public.profiles.client_discount_pct IS
  'Blanket percentage discount for this client. Applied to all products unless overridden by client_custom_prices.';
```

### Price resolution — single source of truth

A new server-side function `resolveClientPricing(profileId, products[])`:

```
resolveClientPricing(profileId, products):
  1. Fetch client_custom_prices WHERE profile_id = profileId
  2. Fetch client_discount_pct from profiles WHERE id = profileId
  3. For each product:
     a. If custom price exists → use custom_price as the product's price
     b. Else if client_discount_pct > 0 → price = base_price × (1 - discount_pct/100)
     c. Else → use base product price
  4. Return products with resolved prices
```

This function is called in exactly **two places**:
1. **Catalogue fetch** (`dashboard/page.tsx`) — so buyers see their custom prices on the order sheet
2. **Checkout action** (`checkout.ts:239-249`) — so orders are calculated with the correct price

Everything downstream (invoices, reports, order history, statements, CSV exports) reads from `order_items.unit_price` which is snapshotted at checkout — no changes needed.

### Injection points — what changes where

| Location | Current | After |
|----------|---------|-------|
| `dashboard/page.tsx` | `getCatalogueData()` returns base prices for all buyers | After cache fetch, call `resolveClientPricing(session.profileId, products)` to apply overrides. **Note:** The catalogue cache is shared across buyers, so resolution must happen AFTER the cache, not inside it. |
| `checkout.ts:239-249` | Re-fetches product prices from `products` table | After re-fetch, call `resolveClientPricing(session.profileId, productRows)` to apply overrides before passing to `computeLineItem()`. |
| `checkout.ts:327` | `unit_price: Number(dbProduct.price)` — snapshots base price | `unit_price: resolvedPrice` — snapshots the resolved (possibly custom) price. |
| `cart/store.ts` | `addItem({ unitPrice: price })` from ProductRow | No change needed — ProductRow already receives the resolved price from the catalogue fetch. |

### Admin UI for managing custom prices

**Where:** Inside the client edit drawer (`ClientDrawer.tsx`) or a dedicated tab, visible only for buyer profiles.

**Workflow:**
1. Admin opens a client profile
2. Admin sees a "Custom Pricing" section
3. Admin searches by product SKU/name
4. Admin selects a product and sets a custom price
5. Admin can also set the `client_discount_pct` field

**Admin actions needed:**
- `setClientCustomPriceAction(profileId, productId, customPrice, notes)`
- `removeClientCustomPriceAction(profileId, productId)`
- `listClientCustomPricesAction(profileId)` — returns all custom prices for a client
- `updateClientDiscountPctAction(profileId, pct)`

### Extensibility to all users

The schema is role-agnostic — `client_custom_prices.profile_id` and `profiles.client_discount_pct` work for any profile. The only role restriction is in the admin UI (showing custom pricing controls only for 30-day accounts initially). Extending to all users = removing one conditional in the admin UI. Zero schema or pipeline changes.

### Edge cases

| Edge case | Resolution |
|-----------|------------|
| Product deleted | `ON DELETE CASCADE` removes custom price rows |
| Client switches from 30-day to default | Custom prices stay dormant in DB. Resolver applies to any role (no role check in resolver). Admin UI gating is separate. |
| Base price changes after custom price set | Custom price is absolute — not relative. Admin must update custom price separately if needed. |
| Reorder with old prices | Cart shows historical price from order_items. At checkout, current resolved price is re-fetched. Buyer sees the difference. This is existing behaviour. |
| Historical invoice integrity | order_items.unit_price is snapshotted — never changes. |
| Bulk discount + custom price | Bulk discount applies on top of custom price (same as base price today). |

---

## Item 1 — Multiple Delivery Locations

### Problem

Buyers currently add a single shipping address (via AddressGateForm) on their first checkout. There's no way to select from multiple addresses or add new ones at checkout time.

### Current state

**Schema (already supports multi-address):**
- `addresses` table with `profile_id` FK, `type` enum ('billing', 'shipping'), `label`, full address fields
- `is_default` boolean with unique partial index: one default per `(profile_id, type)`
- RLS: buyers can CRUD their own addresses

**Current code:**
- `saveAddressAction()` (`src/app/actions/addresses.ts`) — INSERT only, always sets `is_default: true`. No update, delete, or select-default.
- `AddressGateForm` (`src/components/auth/AddressGateForm.tsx`) — single address capture form. No label field, no address picker.
- `checkout.ts:204-214` — checks if any shipping address exists. Doesn't pass selected address to order.
- `CartReviewShell.tsx:260-262` — shows AddressGateForm only when `addressRequired` error is returned.
- `orders.shipping_address` — JSONB column exists but is NEVER populated by checkout.
- `create_order_atomic()` — doesn't include `shipping_address` in the INSERT.

### Solution

#### Data flow

1. **Server component** (`cart/page.tsx`) fetches buyer's shipping addresses from DB
2. Passes addresses array to `CartReviewShell` as a prop
3. `CartReviewShell` renders a `DeliveryAddressPicker` in the right-hand summary column, above Order Summary
4. Buyer selects an address (default pre-selected) or adds a new one
5. On checkout, the selected `addressId` is passed to `checkoutAction`
6. `checkoutAction` fetches the full address, snapshots it as JSONB on `orders.shipping_address`

#### DeliveryAddressPicker component

Positioned in the right column (`lg:col-span-4`), above Order Summary. Inspired by the Takealot reference — compact, unobtrusive.

**Default state (collapsed):**
```
┌─────────────────────────────────────┐
│ Delivery Address            Change  │
│                                     │
│ 12 Bibury Avenue                    │
│ Linkside, Port Elizabeth, 6001      │
└─────────────────────────────────────┘
```

**Expanded state (after clicking "Change"):**
```
┌─────────────────────────────────────┐
│ Delivery Address                    │
│                                     │
│ ○ 12 Bibury Avenue, Linkside...     │
│ ● Cape Town Warehouse, CBD...       │
│ ○ + Add new address                 │
│                                     │
│ [Address form if "Add new" selected]│
│                                     │
│              [Confirm]              │
└─────────────────────────────────────┘
```

**Behaviour:**
- Default address pre-selected on page load
- "Change" toggles the address list
- Radio buttons to select from saved addresses
- "Add new address" expands the AddressGateForm inline (reuse existing component)
- After adding a new address, it's auto-selected and the list collapses
- No edit/delete from this page (future settings page)
- Label field optional when adding

#### Checkout changes

**`checkoutAction` signature change:**
```
Before: checkoutAction(items, orderNotes)
After:  checkoutAction(items, orderNotes, addressId)
```

**Inside checkoutAction:**
- Fetch the selected address by ID (validate ownership)
- Snapshot as JSONB: `{ line1, line2, suburb, city, province, postal_code, country, label }`
- Pass to `create_order_atomic` via `p_order.shipping_address`

**`create_order_atomic` migration:**
- Add `shipping_address` to the INSERT statement

#### New server actions

- `saveAddressAction` — modify to accept optional `label`, return the new address ID
- No update/delete actions needed now (deferred to settings page)

### Files changed

| File | Action |
|------|--------|
| `src/app/(portal)/cart/page.tsx` | Fetch buyer's shipping addresses, pass as prop |
| `src/app/(portal)/cart/CartReviewShell.tsx` | Accept addresses prop, render DeliveryAddressPicker, pass addressId to checkout |
| `src/components/portal/DeliveryAddressPicker.tsx` | **New** — address display/selection component |
| `src/app/actions/addresses.ts` | Modify saveAddressAction to return ID, add label support |
| `src/app/actions/checkout.ts` | Accept addressId, fetch/validate address, snapshot on order |
| Migration: `create_order_atomic` | Add shipping_address to INSERT |

---

## Item 4 — Auto-Generated Account Numbers

### Problem

Buyers who self-register via signup get `account_number = NULL`. The system needs a unique auto-generated account number assigned at signup time.

### Current state

- Legacy buyers (admin-created): manual account_number (e.g. `TEST-EFT-001`)
- Auth buyers (self-registered): `account_number = NULL`, set by `handle_new_buyer_user()` trigger
- Constraint: `buyer_requires_account_number` allows NULL when `auth_user_id IS NOT NULL`
- Format regex: `^[A-Z0-9][A-Z0-9\-]{1,18}[A-Z0-9]$`

### Solution

**Format:** `ARM-NNNNNN` (e.g. `ARM-000001`, `ARM-000002`)
- `ARM` = client brand prefix
- 6-digit zero-padded sequential number
- Capacity: 999,999 accounts
- Matches existing regex constraint

**Implementation:** PostgreSQL sequence + modify existing trigger.

#### Migration

```sql
-- Create sequence for account numbers
CREATE SEQUENCE IF NOT EXISTS public.account_number_seq START 1;

-- Update the trigger to auto-assign account numbers
CREATE OR REPLACE FUNCTION public.handle_new_buyer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
```

**Properties:**
- Collision-safe: PostgreSQL sequences are atomic
- Gap-safe: sequences never reuse values, even on rollback (acceptable — gaps don't matter)
- No application code changes needed
- Existing buyers with NULL account_number are unaffected (they can be backfilled separately if needed)

### Backfill existing NULL accounts

Optional one-time migration to assign account numbers to existing Auth buyers who have `account_number = NULL`:

```sql
UPDATE profiles
SET account_number = 'ARM-' || LPAD(nextval('account_number_seq')::text, 6, '0')
WHERE account_number IS NULL AND auth_user_id IS NOT NULL;
```

### Files changed

| File | Action |
|------|--------|
| Migration SQL | Create sequence, update trigger, optional backfill |

No application code changes. The trigger handles everything at the database level.

---

## Implementation order

1. **Item 4** (account numbers) — single migration, zero application code, zero risk
2. **Item 3** (custom pricing) — schema + resolver + 2 injection points + admin UI
3. **Item 1** (delivery locations) — checkout flow changes + new component

Item 4 is done first because it's independent and risk-free. Item 3 before Item 1 because Item 3 has more surface area and we want it stable before touching the checkout flow for addresses.

---

## Out of scope

- **Address editing/deletion** — deferred to a future settings page
- **Google Places autocomplete** — deferred, additive change later if needed
- **UUID validation fix** — only affects legacy seed data
- **Per-product custom pricing admin bulk import** — can be added later via CSV upload
- **Custom pricing audit log** — existing admin audit log covers product price changes; custom pricing changes can be logged similarly in a later iteration
