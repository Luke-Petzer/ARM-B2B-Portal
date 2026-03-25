/**
 * Frontend-only grouping utilities for the Buyer Catalogue.
 * No database, Zod schema, or Cart store changes required.
 *
 * Naming convention across all 142 SKUs:
 *   Products that share a base spec but differ only by length/orientation/size
 *   are named  "Base Name (Variant)" — e.g. "Carport Pole Round 76x1.2mm (3.0m)"
 *
 * The only exception: L-Plates use single-letter dimension labels in parentheses
 *   e.g. "L-Plate 50(h) x 50(w) x 20(l)" — (h), (w), (l) are NOT grouping variants.
 *
 * Algorithm — extractBaseAndVariation():
 *   1. Find the last "(" and its closing ")".
 *   2. If the content is a single letter  (h / w / l / d) → standalone product.
 *   3. Otherwise:
 *      baseName  = text BEFORE the "(" + any text AFTER the ")" (e.g. thickness suffix)
 *      variation = text INSIDE the parentheses
 *   4. No parentheses at all → standalone product (variation = "Standard").
 *
 * This correctly handles every product in the catalogue:
 *   "Carport Pole Round 76x1.2mm (3.0m)"    → base "Carport Pole Round 76x1.2mm"  var "3.0m"
 *   "Galv. Bracing Strap 25mm (30m)"        → base "Galv. Bracing Strap 25mm"     var "30m"
 *   "AR Palisade Spike 30x30x2mm (400mm)"   → base "AR Palisade Spike 30x30x2mm"  var "400mm"
 *   "Hurricane Clip (Left)"                  → base "Hurricane Clip"               var "Left"
 *   "Gate Wheel in Casing 80mm (V-Groove)"  → base "Gate Wheel in Casing 80mm"    var "V-Groove"
 *   "Galv. Flashing Sidewall 230x75mm (2.4m) 0.4mm"
 *                                            → base "Galv. Flashing Sidewall 230x75mm 0.4mm"
 *                                              var "2.4m"   (thickness stays in base name
 *                                                            so 0.3mm ≠ 0.4mm — no false grouping)
 *   "L-Plate 50(h) x 50(w) x 20(l)"        → standalone  (single-letter guard)
 *   "Galv. Truss Hanger 38mm"               → standalone  (no parens)
 *   "Gate Catch 32mm"                        → standalone  (no parens)
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

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
  variation: string;
}

export interface ProductGroup {
  baseName: string;
  variations: ProductVariant[];
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

export function extractBaseAndVariation(name: string): {
  baseName: string;
  variation: string;
} {
  const lastOpen = name.lastIndexOf("(");
  if (lastOpen === -1) {
    // No parentheses — standalone product
    return { baseName: name.trim(), variation: "Standard" };
  }

  const lastClose = name.indexOf(")", lastOpen);
  if (lastClose === -1) {
    // Unmatched "(" — treat as standalone to be safe
    return { baseName: name.trim(), variation: "Standard" };
  }

  const content = name.slice(lastOpen + 1, lastClose).trim();

  // Guard: L-Plate dimension labels are single letters (h, w, l, d).
  // They are part of the product's own dimension notation, not grouping variants.
  if (/^[a-zA-Z]$/.test(content)) {
    return { baseName: name.trim(), variation: "Standard" };
  }

  const before = name.slice(0, lastOpen).trim();
  // Text after the closing ")" — e.g. "0.4mm" thickness in flashing names.
  // Fold it back into the base name so products with different suffixes do
  // NOT get incorrectly grouped together.
  const after = name.slice(lastClose + 1).trim();

  const baseName = after ? `${before} ${after}` : before;

  return {
    baseName: baseName || name.trim(),
    variation: content || "Standard",
  };
}

// ---------------------------------------------------------------------------
// Grouping function
// Groups a flat product list by baseName, preserving the order of first
// appearance so the catalogue follows the admin-defined SKU sort order.
// ---------------------------------------------------------------------------

export function groupProductsByName(products: ProductRowData[]): ProductGroup[] {
  const map = new Map<string, ProductVariant[]>();

  for (const product of products) {
    const { baseName, variation } = extractBaseAndVariation(product.name);
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
