/**
 * Inventory Zombie Logic Audit
 *
 * Verifies that:
 * 1. Inactive products are rejected at checkout (server-side guard)
 * 2. Stock tracking fields (stock_qty, track_stock, low_stock_alert) are NEVER
 *    referenced in checkoutAction — they cannot accidentally block an order or
 *    cause a DB rollback via legacy constraints.
 *
 * These are static analysis tests (source code assertions). They enforce
 * structural invariants that must hold across all future edits.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const checkoutPath = path.resolve(
  __dirname,
  "../../../src/app/actions/checkout.ts"
);
const checkoutSource = fs.readFileSync(checkoutPath, "utf-8");

describe("Zombie Stock — checkout.ts must NOT reference stock fields", () => {
  it("must NOT reference stock_qty", () => {
    expect(checkoutSource).not.toMatch(/stock_qty/);
  });

  it("must NOT reference low_stock_alert", () => {
    expect(checkoutSource).not.toMatch(/low_stock_alert/);
  });

  it("must NOT reference track_stock", () => {
    expect(checkoutSource).not.toMatch(/track_stock/);
  });
});

describe("Inactive Product Guard — checkout.ts must reject is_active === false", () => {
  it("product fetch selects is_active column", () => {
    // The query must select is_active so the server can evaluate it
    expect(checkoutSource).toMatch(/is_active/);
  });

  it("has a guard that returns an error when is_active is false", () => {
    // Pattern: is_active === false → return { error: ... }
    expect(checkoutSource).toMatch(/is_active.*===.*false/);
  });

  it("inactive product error message is user-friendly", () => {
    // The error message should mention availability, not a raw field name
    expect(checkoutSource).toMatch(/no longer available/);
  });
});

describe("Atomic Function — create_order_atomic must NOT use stock fields", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260326_emergency_hardening.sql"
  );
  const migrationSource = fs.readFileSync(migrationPath, "utf-8");

  it("create_order_atomic does not INSERT into stock_qty", () => {
    // The atomic function must not touch stock_qty, preventing any implicit lock
    expect(migrationSource).not.toMatch(/stock_qty/);
  });

  it("create_order_atomic does not reference track_stock", () => {
    expect(migrationSource).not.toMatch(/track_stock/);
  });

  it("function only inserts into orders and order_items tables", () => {
    // Verify the function touches exactly the expected tables
    expect(migrationSource).toContain("INSERT INTO public.orders");
    expect(migrationSource).toContain("INSERT INTO public.order_items");
    // No other INSERT statements
    const insertMatches = migrationSource.match(/INSERT INTO/g) ?? [];
    expect(insertMatches.length).toBe(2);
  });
});
