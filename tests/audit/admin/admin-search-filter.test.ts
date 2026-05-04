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

  it("search variable is guarded with if (search)", () => {
    expect(source).toMatch(/if\s*\(\s*search\s*\)/);
  });

  it("or() call includes reference_number ilike", () => {
    expect(source).toMatch(/reference_number\.ilike/);
  });

  it("or() call includes business_name ilike (joined relation)", () => {
    expect(source).toMatch(/business_name\.ilike/);
  });

  it("or() call includes account_number ilike (joined relation)", () => {
    expect(source).toMatch(/account_number\.ilike/);
  });
});
