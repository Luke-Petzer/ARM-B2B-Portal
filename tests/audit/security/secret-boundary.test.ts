import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Secret Boundary: config.ts", () => {
  const configPath = path.resolve(__dirname, "../../../src/lib/supabase/config.ts");
  const configSource = fs.readFileSync(configPath, "utf-8");

  // config.ts intentionally does NOT have server-only — it only exports NEXT_PUBLIC_ vars
  // which are safe for browser/middleware. Adding server-only here broke the build
  // (Turbopack error) because browser.ts and middleware.ts both import from config.ts.
  it("must NOT export supabaseServiceRoleKey — service role key belongs in admin.ts only", () => {
    expect(configSource).not.toContain("supabaseServiceRoleKey");
    expect(configSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("only exports NEXT_PUBLIC_ vars (safe for client bundle)", () => {
    expect(configSource).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(configSource).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
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

  it("admin.ts has server-only guard", () => {
    expect(adminSource).toMatch(/import\s+["']server-only["']/);
  });

  it("admin.ts owns SUPABASE_SERVICE_ROLE_KEY directly (not re-exported from config.ts)", () => {
    // The service role key must be read inside a server-only module.
    // It was moved from config.ts to here to avoid breaking browser.ts / middleware imports.
    expect(adminSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
