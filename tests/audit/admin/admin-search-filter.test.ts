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

  it("wildcards are escaped before interpolation", () => {
    // % and _ are ILIKE metacharacters — must be escaped
    expect(source).toMatch(/replace\(.*%.*\\\\%/);
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
