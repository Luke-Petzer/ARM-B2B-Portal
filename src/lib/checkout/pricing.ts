// src/lib/checkout/pricing.ts
// Pure financial calculation functions — NO server-only, NO DB calls.
// Intentionally side-effect-free so they can be unit-tested directly.
//
// SECURITY INVARIANT: These functions only accept DB-sourced values.
// The client-supplied unitPrice is NEVER passed here.

/**
 * Round to 2 decimal places using the EPSILON nudge pattern.
 *
 * `toFixed(2)` is unreliable for IEEE 754 half-values: `(1.005).toFixed(2)`
 * returns "1.00" because 1.005 is stored as 1.00499999... in binary float.
 * Adding Number.EPSILON before scaling nudges such values into the correct
 * rounding direction. Fixes FINDING-160.
 */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface DbProductPricing {
  price: number | string;
  cost_price: number | string | null;
  pack_size: number;
  discount_type: string | null;
  discount_threshold: number | null;
  discount_value: number | string | null;
}

/**
 * Computes the effective per-unit price for a line item.
 *
 * Uses ONLY DB-sourced values. The client-supplied unitPrice is NEVER passed here.
 *
 * Discount rules:
 *   percentage: effectivePrice = dbPrice × (1 − discountValue / 100)
 *   fixed:      effectivePrice = dbPrice − discountValue
 *
 * Returns dbPrice unchanged if:
 *   - no discount_type set
 *   - discount_value is null / non-finite
 *   - discount_threshold is null
 *   - quantity < discount_threshold
 */
export function computeEffectiveUnitPrice(
  dbProduct: DbProductPricing,
  quantity: number
): number {
  const dbPrice = Number(dbProduct.price);

  if (
    !dbProduct.discount_type ||
    dbProduct.discount_value == null ||
    dbProduct.discount_threshold == null ||
    quantity < dbProduct.discount_threshold
  ) {
    return dbPrice;
  }

  const val = Number(dbProduct.discount_value);
  if (!isFinite(val)) return dbPrice;

  if (dbProduct.discount_type === "percentage") {
    return Math.max(0, r2(dbPrice * (1 - val / 100)));
  }

  // fixed
  return Math.max(0, r2(dbPrice - val));
}

export interface LineItemPricing {
  effectiveUnitPrice: number;
  lineTotal: number;
  discountPct: number;
}

/**
 * Computes effective unit price, line total, and discount percentage for one line item.
 * discountPct is stored on the order_items row for reporting.
 */
export function computeLineItem(
  dbProduct: DbProductPricing,
  quantity: number
): LineItemPricing {
  const dbPrice = Number(dbProduct.price);
  const effectiveUnitPrice = computeEffectiveUnitPrice(dbProduct, quantity);
  const lineTotal = r2(effectiveUnitPrice * quantity);
  const discountSaving = dbPrice - effectiveUnitPrice;
  const discountPct =
    dbPrice > 0
      ? parseFloat(((discountSaving / dbPrice) * 100).toFixed(4))
      : 0;

  return { effectiveUnitPrice, lineTotal, discountPct };
}

export interface OrderTotals {
  subtotal: number;
  totalDiscountAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Aggregates line items into order-level totals.
 *
 * @param lineTotals       - pre-computed per-line totals (r2-rounded)
 * @param discountSavings  - per-line discount savings: (dbPrice - effectivePrice) × qty
 * @param vatRate          - decimal e.g. 0.15 for 15%
 */
export function computeOrderTotals(
  lineTotals: number[],
  discountSavings: number[],
  vatRate: number
): OrderTotals {
  const subtotal = r2(lineTotals.reduce((s, lt) => s + lt, 0));
  const totalDiscountAmount = r2(discountSavings.reduce((s, d) => s + d, 0));
  const vatAmount = r2(subtotal * vatRate);
  const totalAmount = r2(subtotal + vatAmount);
  return { subtotal, totalDiscountAmount, vatAmount, totalAmount };
}
