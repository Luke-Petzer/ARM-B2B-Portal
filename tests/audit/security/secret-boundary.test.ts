import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Secret Boundary: config.ts", () => {
  const configPath = path.resolve(__dirname, "../../../src/lib/supabase/config.ts");
  const configSource = fs.readFileSync(configPath, "utf-8");

  it("must import server-only to prevent service role key from entering the client bundle", () => {
    expect(configSource).toMatch(/import\s+["']server-only["']/);
  });

  it("exports supabaseServiceRoleKey (presence is fine with server-only guard in place)", () => {
    expect(configSource).toContain("supabaseServiceRoleKey");
  });
});

describe("Secret Boundary: checkout.ts inline env reference", () => {
  const checkoutPath = path.resolve(__dirname, "../../../src/app/actions/checkout.ts");
  const checkoutSource = fs.readFileSync(checkoutPath, "utf-8");

  it("checkout.ts must have 'use server' directive as first statement", () => {
    // 'use server' ensures this module is never included in the client bundle
    const hasUseServer = checkoutSource.trimStart().startsWith('"use server"');
    expect(hasUseServer).toBe(true);
  });

  it("checkout.ts direct env reference to SUPABASE_SERVICE_ROLE_KEY is only in a server-only context", () => {
    // The broadcast fetch uses process.env.SUPABASE_SERVICE_ROLE_KEY directly.
    // This is only safe because of the 'use server' directive.
    // This test documents that awareness.
    if (checkoutSource.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      const hasUseServer = checkoutSource.trimStart().startsWith('"use server"');
      expect(hasUseServer).toBe(true);
    }
  });
});

describe("Secret Boundary: admin.ts", () => {
  const adminPath = path.resolve(__dirname, "../../../src/lib/supabase/admin.ts");
  const adminSource = fs.readFileSync(adminPath, "utf-8");

  it("admin.ts already has server-only guard", () => {
    expect(adminSource).toMatch(/import\s+["']server-only["']/);
  });
});
