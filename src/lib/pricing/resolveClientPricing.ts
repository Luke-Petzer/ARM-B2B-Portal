// src/lib/pricing/resolveClientPricing.ts
// Pure price resolution function — no DB calls in resolveProductPrices.
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
 *   2. Client-level discount percentage (all products without a custom price)
 *   3. Base product price (default)
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
