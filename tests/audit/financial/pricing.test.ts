import { describe, it, expect } from "vitest";
import {
  r2,
  computeEffectiveUnitPrice,
  computeLineItem,
  computeOrderTotals,
  type DbProductPricing,
} from "../../../src/lib/checkout/pricing";

// ── Helper ────────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<DbProductPricing> = {}): DbProductPricing {
  return {
    price: 100,
    cost_price: 60,
    pack_size: 1,
    discount_type: null,
    discount_threshold: null,
    discount_value: null,
    ...overrides,
  };
}

// ── r2 (rounding) ─────────────────────────────────────────────────────────────

describe("r2 — rounding helper", () => {
  it("rounds down correctly", () => {
    expect(r2(1.234)).toBe(1.23);
  });

  it("rounds up correctly", () => {
    expect(r2(1.235)).toBe(1.24);
  });

  it("handles zero", () => {
    expect(r2(0)).toBe(0);
  });

  it("handles integers unchanged", () => {
    expect(r2(100)).toBe(100);
  });

  it("handles negative numbers", () => {
    expect(r2(-1.567)).toBe(-1.57);
  });

  it("handles very large numbers without precision loss", () => {
    expect(r2(999999.004)).toBe(999999);
  });
});

// ── computeEffectiveUnitPrice ─────────────────────────────────────────────────

describe("computeEffectiveUnitPrice — no discount rules", () => {
  it("returns db price when discount_type is null", () => {
    const product = makeProduct({ price: 50, discount_type: null });
    expect(computeEffectiveUnitPrice(product, 10)).toBe(50);
  });

  it("returns db price when discount_value is null", () => {
    const product = makeProduct({
      price: 50,
      discount_type: "percentage",
      discount_threshold: 5,
      discount_value: null,
    });
    expect(computeEffectiveUnitPrice(product, 10)).toBe(50);
  });

  it("returns db price when discount_threshold is null", () => {
    const product = makeProduct({
      price: 50,
      discount_type: "percentage",
      discount_threshold: null,
      discount_value: 10,
    });
    expect(computeEffectiveUnitPrice(product, 10)).toBe(50);
  });
});

describe("computeEffectiveUnitPrice — percentage discounts", () => {
  const product = makeProduct({
    price: 100,
    discount_type: "percentage",
    discount_threshold: 5,
    discount_value: 10, // 10% off
  });

  it("applies discount when quantity >= threshold", () => {
    expect(computeEffectiveUnitPrice(product, 5)).toBe(90);
    expect(computeEffectiveUnitPrice(product, 10)).toBe(90);
    expect(computeEffectiveUnitPrice(product, 100)).toBe(90);
  });

  it("does NOT apply discount when quantity < threshold", () => {
    expect(computeEffectiveUnitPrice(product, 4)).toBe(100);
    expect(computeEffectiveUnitPrice(product, 1)).toBe(100);
  });

  it("boundary: quantity exactly equals threshold DOES trigger discount", () => {
    expect(computeEffectiveUnitPrice(product, 5)).toBe(90);
  });

  it("boundary: quantity one below threshold does NOT trigger discount", () => {
    expect(computeEffectiveUnitPrice(product, 4)).toBe(100);
  });

  it("100% discount results in 0, not negative", () => {
    const fullDiscount = makeProduct({
      price: 100,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: 100,
    });
    expect(computeEffectiveUnitPrice(fullDiscount, 1)).toBe(0);
  });

  it("discount > 100% is clamped to 0", () => {
    const overDiscount = makeProduct({
      price: 100,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: 150,
    });
    expect(computeEffectiveUnitPrice(overDiscount, 1)).toBe(0);
  });

  it("fractional percentage produces correct 2dp result", () => {
    const prod = makeProduct({
      price: 99.99,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: 12.5,
    });
    // 99.99 × (1 - 0.125) = 99.99 × 0.875 = 87.49125 → r2 → 87.49
    expect(computeEffectiveUnitPrice(prod, 1)).toBe(87.49);
  });
});

describe("computeEffectiveUnitPrice — fixed discounts", () => {
  const product = makeProduct({
    price: 50,
    discount_type: "fixed",
    discount_threshold: 3,
    discount_value: 10, // R10 off
  });

  it("applies fixed discount when quantity >= threshold", () => {
    expect(computeEffectiveUnitPrice(product, 3)).toBe(40);
    expect(computeEffectiveUnitPrice(product, 10)).toBe(40);
  });

  it("does NOT apply when quantity < threshold", () => {
    expect(computeEffectiveUnitPrice(product, 2)).toBe(50);
  });

  it("clamps to 0 when discount > price", () => {
    const overFixed = makeProduct({
      price: 10,
      discount_type: "fixed",
      discount_threshold: 1,
      discount_value: 20,
    });
    expect(computeEffectiveUnitPrice(overFixed, 1)).toBe(0);
  });

  it("discount exactly equals price results in 0", () => {
    const zeroFixed = makeProduct({
      price: 10,
      discount_type: "fixed",
      discount_threshold: 1,
      discount_value: 10,
    });
    expect(computeEffectiveUnitPrice(zeroFixed, 1)).toBe(0);
  });
});

describe("computeEffectiveUnitPrice — edge cases", () => {
  it("handles string price (Supabase NUMERIC returns string)", () => {
    const product = makeProduct({ price: "99.99" as unknown as number });
    expect(computeEffectiveUnitPrice(product, 1)).toBe(99.99);
  });

  it("handles string discount_value (Supabase NUMERIC returns string)", () => {
    const product = makeProduct({
      price: 100,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: "10" as unknown as number,
    });
    expect(computeEffectiveUnitPrice(product, 1)).toBe(90);
  });

  it("handles non-finite discount_value (returns db price unchanged)", () => {
    const product = makeProduct({
      price: 100,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: Infinity,
    });
    expect(computeEffectiveUnitPrice(product, 1)).toBe(100);
  });

  it("handles zero price with percentage discount — result is 0, not NaN", () => {
    const product = makeProduct({
      price: 0,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: 10,
    });
    expect(computeEffectiveUnitPrice(product, 1)).toBe(0);
  });

  it("handles zero price with fixed discount — clamped to 0", () => {
    const product = makeProduct({
      price: 0,
      discount_type: "fixed",
      discount_threshold: 1,
      discount_value: 5,
    });
    expect(computeEffectiveUnitPrice(product, 1)).toBe(0);
  });
});

// ── computeLineItem ───────────────────────────────────────────────────────────

describe("computeLineItem", () => {
  it("returns full-price line when no discount", () => {
    const product = makeProduct({ price: 25 });
    const result = computeLineItem(product, 4);
    expect(result.effectiveUnitPrice).toBe(25);
    expect(result.lineTotal).toBe(100);
    expect(result.discountPct).toBe(0);
  });

  it("computes correct discount percentage for percentage discount", () => {
    const product = makeProduct({
      price: 100,
      discount_type: "percentage",
      discount_threshold: 1,
      discount_value: 20,
    });
    const result = computeLineItem(product, 5);
    expect(result.effectiveUnitPrice).toBe(80);
    expect(result.lineTotal).toBe(400);
    expect(result.discountPct).toBe(20);
  });

  it("computes correct discount percentage for fixed discount", () => {
    const product = makeProduct({
      price: 100,
      discount_type: "fixed",
      discount_threshold: 1,
      discount_value: 25,
    });
    const result = computeLineItem(product, 2);
    expect(result.effectiveUnitPrice).toBe(75);
    expect(result.lineTotal).toBe(150);
    expect(result.discountPct).toBe(25);
  });

  it("discountPct is 0 when price is 0 — avoids division-by-zero", () => {
    const product = makeProduct({ price: 0 });
    const result = computeLineItem(product, 3);
    expect(result.discountPct).toBe(0);
    expect(Number.isNaN(result.discountPct)).toBe(false);
  });

  it("handles large quantity correctly", () => {
    const product = makeProduct({ price: 9.99 });
    const result = computeLineItem(product, 1000);
    expect(result.lineTotal).toBe(9990);
  });

  it("rounds line total to 2 decimal places", () => {
    const product = makeProduct({ price: 33.3333 });
    const result = computeLineItem(product, 3);
    expect(result.lineTotal).toBe(r2(33.3333 * 3));
  });
});

// ── computeOrderTotals ────────────────────────────────────────────────────────

describe("computeOrderTotals", () => {
  it("computes correct totals with 15% VAT", () => {
    const lineTotals = [100, 200, 50];
    const discountSavings = [0, 20, 0];
    const result = computeOrderTotals(lineTotals, discountSavings, 0.15);

    expect(result.subtotal).toBe(350);
    expect(result.totalDiscountAmount).toBe(20);
    expect(result.vatAmount).toBe(52.5);
    expect(result.totalAmount).toBe(402.5);
  });

  it("handles 0% VAT (VAT-exempt orders)", () => {
    const result = computeOrderTotals([100], [0], 0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(100);
  });

  it("handles empty lineTotals array — all zeros, no crash", () => {
    const result = computeOrderTotals([], [], 0.15);
    expect(result.subtotal).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.totalDiscountAmount).toBe(0);
  });

  it("rounds VAT to 2 decimal places — no rounding drift", () => {
    // subtotal = 99.99, 15% = 14.9985 → r2 → 15.00
    const result = computeOrderTotals([99.99], [0], 0.15);
    expect(result.vatAmount).toBe(15);
    expect(result.totalAmount).toBe(114.99);
  });

  it("handles multiple items with fractional prices summing cleanly", () => {
    const lineTotals = [33.33, 66.67];
    const result = computeOrderTotals(lineTotals, [0, 0], 0.15);
    expect(result.subtotal).toBe(100);
    expect(result.vatAmount).toBe(15);
    expect(result.totalAmount).toBe(115);
  });

  it("totalAmount === r2(subtotal + vatAmount) — no accumulated drift", () => {
    const lineTotals = [49.99, 49.99];
    const result = computeOrderTotals(lineTotals, [0, 0], 0.15);
    expect(result.totalAmount).toBe(r2(result.subtotal + result.vatAmount));
  });

  it("totalDiscountAmount aggregates multiple discounts correctly", () => {
    const lineTotals = [90, 80];
    const discountSavings = [10, 20]; // R10 + R20 saved
    const result = computeOrderTotals(lineTotals, discountSavings, 0.15);
    expect(result.totalDiscountAmount).toBe(30);
    expect(result.subtotal).toBe(170);
  });
});
