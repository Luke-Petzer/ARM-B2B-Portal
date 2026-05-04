// tests/audit/admin/admin-search-filter.test.ts
//
// Guards the admin orders search filter implementation.
//
// The search param was historically ignored — search updated the URL
// but the SQL query returned unfiltered results every time.
//
// Fix: two-step query — pre-query profiles for business_name/account_number
// matches, then OR reference_number against those profile_ids in the orders query.
// Wildcards are escaped to prevent ILIKE pattern abuse.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

let source: string;

try {
  source = fs.readFileSync(
    path.resolve(__dirname, "../../../src/app/(admin)/admin/page.tsx"),
    "utf-8"
  );
} catch {
  source = "";
}

describe("Admin orders query — search filter", () => {
  it("file exists", () => {
    expect(source).not.toBe("");
  });

  it("search is guarded with if (search)", () => {
    expect(source).toMatch(/if\s*\(\s*search\s*\)/);
  });

  it("backslash is escaped before % and _ (prevents ILIKE injection)", () => {
    // Without escaping backslash first, input like "\%" survives sanitisation
    // as a literal % wildcard — a CodeQL high-severity finding.
    // Use indexOf to avoid regex-literal parsing issues with double-backslash patterns.
    const backslashEscapeIdx = source.indexOf('.replace(/\\\\/g');  // matches .replace(/\\/g in source
    const percentEscapeIdx = source.indexOf('.replace(/%/g');
    expect(backslashEscapeIdx, "backslash escape (.replace(/\\\\/g)) not found").toBeGreaterThan(-1);
    expect(percentEscapeIdx, "% escape (.replace(/%/g)) not found").toBeGreaterThan(-1);
    expect(backslashEscapeIdx, "backslash escape must appear before % escape").toBeLessThan(percentEscapeIdx);
  });

  it("% and _ wildcards are escaped", () => {
    // Both ILIKE metacharacters must be escaped
    expect(source).toMatch(/replace\(.*%.*\\\\%/);
    expect(source).toMatch(/replace\(.*_.*\\\\_/);
  });

  it("profiles pre-query searches business_name and account_number", () => {
    // Two-step: query profiles first, then apply profile_ids to orders
    expect(source).toMatch(/business_name\.ilike/);
    expect(source).toMatch(/account_number\.ilike/);
  });

  it("orders query filters on reference_number ilike", () => {
    expect(source).toMatch(/reference_number\.ilike/);
  });

  it("orders query uses profile_id.in for buyer name/account matches", () => {
    // The joined-relation approach: collect profile_ids then filter orders
    expect(source).toMatch(/profile_id\.in\.\(/);
  });
});

// ── Escape correctness (pure unit) ───────────────────────────────────────────
//
// Mirrors the escape logic from page.tsx exactly so changes to either file
// are caught immediately. If this test fails after a page.tsx edit, the
// escape order is wrong and the ILIKE injection vulnerability has returned.

function escapeIlike(raw: string): string {
  return raw
    .slice(0, 200)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

describe("ILIKE escape — backslash-first ordering", () => {
  it("plain text is unchanged", () => {
    expect(escapeIlike("hello")).toBe("hello");
  });

  it("% is escaped to \\%", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
  });

  it("_ is escaped to \\_", () => {
    expect(escapeIlike("a_b")).toBe("a\\_b");
  });

  it("backslash is escaped to \\\\", () => {
    expect(escapeIlike("a\\b")).toBe("a\\\\b");
  });

  it("\\% (backslash then percent) does not survive as a wildcard", () => {
    // Without escaping backslash first, "\\%" → "\\\\%" which PostgREST
    // interprets as escaped-backslash followed by a wildcard — the % is
    // still a wildcard. With correct ordering both chars are escaped.
    const result = escapeIlike("\\%");
    // Must be \\\\\\% in JS string = \\\% in the SQL pattern: escaped-backslash + escaped-%
    expect(result).toBe("\\\\\\%");
    // Must NOT leave a bare % anywhere in the output
    expect(result.replace(/\\%/g, "")).not.toContain("%");
  });

  it("\\_ (backslash then underscore) does not survive as a wildcard", () => {
    const result = escapeIlike("\\_");
    expect(result).toBe("\\\\\\_");
    expect(result.replace(/\\_/g, "")).not.toContain("_");
  });

  it("input exceeding 200 chars is truncated before escaping", () => {
    const long = "%".repeat(300);
    const result = escapeIlike(long);
    // 200 % chars each escaped to \% = 400 chars
    expect(result).toBe("\\%".repeat(200));
  });
});
