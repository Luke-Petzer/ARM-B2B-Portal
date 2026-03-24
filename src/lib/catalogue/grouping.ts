/**
 * Frontend-only grouping utilities for the Buyer Catalogue.
 * No database or server-action changes required.
 *
 * Naming convention assumed:  "Base Name (Variation)"
 * Example: "Carport Pole Round 76x1.2mm (3.0m)"
 *   → baseName:  "Carport Pole Round 76x1.2mm"
 *   → variation: "3.0m"
 *
 * Fault tolerance: products with no parentheses (e.g. "Custom Bracket")
 * are treated as a single-variation group with variation = "Standard".
 */

export interface ProductRowData {
  productId: string;
  sku: string;
  name: string;
  description: string | null;
  details: string | null;
  price: number;
  primaryImageUrl: string | null;
  discountType: "percentage" | "fixed" | null;
  discountThreshold: number | null;
  discountValue: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
}

export interface ProductVariant extends ProductRowData {
  /** The text inside the parentheses, e.g. "3.0m" */
  variation: string;
}

export interface ProductGroup {
  /** Everything before the last "(" in the product name */
  baseName: string;
  variations: ProductVariant[];
}

/**
 * Splits a product name into base name + variation label.
 * Splits at the LAST open-parenthesis so names like
 * "Pole (Round) (3.0m)" correctly yield variation = "3.0m".
 */
export function parseProductName(name: string): {
  baseName: string;
  variation: string;
} {
  const lastParen = name.lastIndexOf("(");
  if (lastParen === -1) {
    return { baseName: name.trim(), variation: "Standard" };
  }
  const baseName = name.slice(0, lastParen).trim();
  const variation = name.slice(lastParen + 1).replace(/\)\s*$/, "").trim();
  return {
    baseName: baseName || name.trim(),
    variation: variation || "Standard",
  };
}

/**
 * Groups a flat product list by base name, preserving order of first
 * appearance so the catalogue order matches the admin-defined SKU order.
 */
export function groupProductsByName(products: ProductRowData[]): ProductGroup[] {
  const map = new Map<string, ProductVariant[]>();

  for (const product of products) {
    const { baseName, variation } = parseProductName(product.name);
    if (!map.has(baseName)) {
      map.set(baseName, []);
    }
    map.get(baseName)!.push({ ...product, variation });
  }

  return Array.from(map.entries()).map(([baseName, variations]) => ({
    baseName,
    variations,
  }));
}
