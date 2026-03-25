/**
 * Frontend-only grouping utilities for the Buyer Catalogue.
 * No database, Zod schema, or Cart store changes required.
 *
 * extractBaseAndVariation() applies four rules in priority order to handle
 * the inconsistently-formatted real-world product names in the catalogue.
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
// Rule 1 — Known prefix table
// Sorted longest-first so a longer, more-specific prefix always wins over
// a shorter prefix that happens to be a substring (e.g. "Galv. Bracing Strap
// 25mm" must not be claimed by a hypothetical shorter "Galv." rule first).
// ---------------------------------------------------------------------------

const KNOWN_PREFIXES: readonly string[] = [
  "AR Palisade Spike 30x30x2mm",
  "Argo StrikeMax Welding Rods",
  "Galv. Bracing Strap 25mm",
  "Galv. Hoop Iron 32mm",
  "Razor Wire Comb 2mm",
  "Gate Wheel in Casing",
  "Truss Nail Plate",
  "Argo Cutting Disk",
  "Gate Wheel Loose",
  "Argo Wheel Kit",
  "L-Plate",
].sort((a, b) => b.length - a.length);

/**
 * Cleans artefacts from variation strings produced by Rule 1.
 * Removes stray closing parentheses and isolated "l" characters that appear
 * in some L-Plate product names (e.g. "150x150x5mm l)" → "150x150x5mm").
 */
function cleanVariation(raw: string): string {
  return raw
    .replace(/\)/g, "")        // remove stray ")"
    .replace(/\bl\b/gi, "")    // remove isolated "l" / "L" characters
    .replace(/\s+/g, " ")      // collapse whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Trailing-length regex — Rule 3
// Matches a standalone length token at the end of a name, e.g.:
//   "Carport Pole Round 76x1.2mm 3.0m"  →  base "Carport Pole Round 76x1.2mm", variation "3.0m"
//   "Square Tube 25x25x1.6mm 6.0m"      →  base "Square Tube 25x25x1.6mm",     variation "6.0m"
// Greedy first group backtracks correctly past embedded specs like "76x1.2mm"
// because the anchored length token must reach end-of-string ($).
// ---------------------------------------------------------------------------

const TRAILING_LENGTH_RE = /^(.+)\s+(\d+(?:\.\d+)?m)$/;

// ---------------------------------------------------------------------------
// Main heuristic parser
// ---------------------------------------------------------------------------

export function extractBaseAndVariation(name: string): {
  baseName: string;
  variation: string;
} {
  // ── Rule 1: Known-prefix categories ────────────────────────────────────────
  for (const prefix of KNOWN_PREFIXES) {
    if (name.startsWith(prefix)) {
      const remainder = name.slice(prefix.length);
      const variation = cleanVariation(remainder);
      return {
        baseName: prefix,
        variation: variation || "Standard",
      };
    }
  }

  // ── Rule 2: Electro-Galv / Galv. finish prefix pairs ───────────────────────
  // "Electro-Galv. Gate Catch 32mm"  → base "Gate Catch 32mm",  variation "Electro-Galv."
  // "Galv. Lock Box 150mm"           → base "Lock Box 150mm",   variation "Galv."
  // The plain counterpart ("Gate Catch 32mm") falls through to Rule 4 and gets
  // variation "Standard", so the two products group together automatically.
  if (name.startsWith("Electro-Galv. ")) {
    return {
      baseName: name.slice("Electro-Galv. ".length).trim(),
      variation: "Electro-Galv.",
    };
  }
  if (name.startsWith("Galv. ")) {
    return {
      baseName: name.slice("Galv. ".length).trim(),
      variation: "Galv.",
    };
  }

  // ── Rule 3: Trailing length token (poles, tubes, sections) ─────────────────
  const lengthMatch = TRAILING_LENGTH_RE.exec(name);
  if (lengthMatch) {
    return {
      baseName: lengthMatch[1].trim(),
      variation: lengthMatch[2],
    };
  }

  // ── Rule 4: Standalone product — no grouping applies ───────────────────────
  return { baseName: name.trim(), variation: "Standard" };
}

// ---------------------------------------------------------------------------
// Grouping function
// Groups a flat product list by baseName, preserving order of first appearance
// so the catalogue order matches the admin-defined SKU order.
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
