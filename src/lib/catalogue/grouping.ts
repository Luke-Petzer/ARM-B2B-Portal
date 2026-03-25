/**
 * Frontend-only grouping utilities for the Buyer Catalogue.
 * No database, Zod schema, or Cart store changes required.
 *
 * Four rules applied in priority order — see groupProductsByName() for the
 * two-pass implementation that enables the dynamic galvanised-pair matching.
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
// Rule 1 — Galvanised-pair prefixes
// ---------------------------------------------------------------------------

const GALV_PREFIXES = ["Electro-Galv. ", "Galv. "] as const;

// ---------------------------------------------------------------------------
// Rule 2 — Known prefix dictionary (sorted longest-first to prevent a
// shorter prefix shadowing a longer, more-specific one)
// ---------------------------------------------------------------------------

const KNOWN_PREFIXES: readonly string[] = [
  "Argo StrikeMax Welding Rods",   // 27
  "Galv. Flashing Barge Board",    // 26
  "Washing Line Pole Round",        // 23
  "Galv. Flashing Sidewall",        // 23
  "Galv. Nylon Guide Track",        // 23
  "Gate Wheel in Casing",           // 20
  "Carport Pole Square",            // 19
  "Galv. Bracing Strap",            // 19
  "Carport Pole Round",             // 18
  "AR Palisade Spike",              // 17
  "Guide Nylon Wheel",              // 17
  "Argo Cutting Disk",              // 17
  "Lug 90° 50 x 25",               // 16
  "Truss Nail Plate",               // 16
  "Gate Wheel Loose",               // 15
  "Galv. Hoop Iron",               // 15
  "Argo Wheel Kit",                 // 14
  "Lug Feet 16mm",                  // 13
  "Lug 50 x 25",                    // 11
  "L-Plate",                        // 7
].sort((a, b) => b.length - a.length);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cleans the remainder string produced by Rule 2 prefix stripping.
 * - Removes "(" and ")" characters
 * - Removes isolated dimension-label letters (h, w, l, d) from L-Plate names
 * - Collapses whitespace
 */
function cleanVariation(raw: string): string {
  return raw
    .replace(/[()]/g, "")
    .replace(/\b[hwld]\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Rule 3 — Trailing length patterns
//
// Handles products not caught by Rules 1 or 2 that still follow a
// "Base Name (Length)" or "Base Name (Length) Suffix" convention.
//
// Pattern A: "Razor Wire Concertina (11m)"
//   → base "Razor Wire Concertina", variation "11m"
// Pattern B: "Galv. Flashing Sidewall 230x75mm (2.4m) 0.4mm"
//   → would be caught by Rule 2 first; Pattern B is a safety net
//   → base "Galv. Flashing Sidewall 230x75mm 0.4mm", variation "2.4m"
// ---------------------------------------------------------------------------

/** Matches "Base Name (Xm)" with an optional suffix after the closing paren */
const RE_PAREN_LENGTH =
  /^(.+?)\s*\((\d+(?:\.\d+)?m)\)\s*(.*)$/;

/** Matches "Base Name Xm" (bare, no parens) */
const RE_BARE_LENGTH = /^(.+)\s+(\d+(?:\.\d+)?m)$/;

// ---------------------------------------------------------------------------
// Core extraction function
// ---------------------------------------------------------------------------

function _extract(
  name: string,
  allNames: Set<string>,
  galvPairedBaseNames: Set<string>
): { baseName: string; variation: string } {

  // ── Rule 1a: This name IS the "Standard" counterpart of a galv-prefixed pair ──
  // (determined during the pre-pass in groupProductsByName)
  if (galvPairedBaseNames.has(name)) {
    return { baseName: name, variation: "Standard" };
  }

  // ── Rule 1b: Galv-prefixed product whose bare counterpart exists ─────────
  for (const prefix of GALV_PREFIXES) {
    if (name.startsWith(prefix)) {
      const stripped = name.slice(prefix.length).trim();
      if (allNames.has(stripped)) {
        return {
          baseName: stripped,
          variation: prefix.trim(), // "Electro-Galv." or "Galv."
        };
      }
      // Starts with a galv prefix but no counterpart — fall through to Rule 2
      break;
    }
  }

  // ── Rule 2: Known prefix dictionary ──────────────────────────────────────
  for (const prefix of KNOWN_PREFIXES) {
    if (name.startsWith(prefix)) {
      const remainder = name.slice(prefix.length);
      return {
        baseName: prefix,
        variation: cleanVariation(remainder) || "Standard",
      };
    }
  }

  // ── Rule 3: Trailing length token ────────────────────────────────────────
  const parenMatch = RE_PAREN_LENGTH.exec(name);
  if (parenMatch) {
    const base = parenMatch[1].trim();
    const length = parenMatch[2];
    const suffix = parenMatch[3].trim();
    return {
      baseName: suffix ? `${base} ${suffix}` : base,
      variation: length,
    };
  }

  const bareMatch = RE_BARE_LENGTH.exec(name);
  if (bareMatch) {
    return { baseName: bareMatch[1].trim(), variation: bareMatch[2] };
  }

  // ── Rule 4: Standalone product ───────────────────────────────────────────
  return { baseName: name.trim(), variation: "Standard" };
}

// ---------------------------------------------------------------------------
// Public grouping function
// Two-pass: first builds the galv-pair context, then classifies every product.
// ---------------------------------------------------------------------------

export function groupProductsByName(products: ProductRowData[]): ProductGroup[] {
  // Build a Set of every exact product name for O(1) Rule-1 lookups
  const allNames = new Set(products.map((p) => p.name));

  // Pre-pass: identify all "standard" names that have a galv-prefixed twin.
  // E.g. if "Electro-Galv. Lock Holder" exists and "Lock Holder" exists →
  // "Lock Holder" goes into galvPairedBaseNames so it gets variation "Standard"
  // instead of being processed by Rule 2/3/4 independently.
  const galvPairedBaseNames = new Set<string>();
  for (const product of products) {
    for (const prefix of GALV_PREFIXES) {
      if (product.name.startsWith(prefix)) {
        const stripped = product.name.slice(prefix.length).trim();
        if (allNames.has(stripped)) {
          galvPairedBaseNames.add(stripped);
        }
        break;
      }
    }
  }

  // Main pass: classify each product and group by baseName
  const map = new Map<string, ProductVariant[]>();

  for (const product of products) {
    const { baseName, variation } = _extract(
      product.name,
      allNames,
      galvPairedBaseNames
    );
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
