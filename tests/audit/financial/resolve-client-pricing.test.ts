import { describe, it, expect } from "vitest";
import {
  resolveProductPrices,
  type CustomPriceEntry,
  type ProductWithPrice,
} from "../../../src/lib/pricing/resolveClientPricing";

function makeProduct(id: string, price: number): ProductWithPrice {
  return { id, price };
}

describe("resolveProductPrices", () => {
  it("returns base price when no custom pricing exists", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 50)];
    const result = resolveProductPrices(products, [], 0);
    expect(result).toEqual([
      { id: "p1", price: 100 },
      { id: "p2", price: 50 },
    ]);
  });

  it("applies per-product custom price override", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 50)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p1", custom_price: 85 },
    ];
    const result = resolveProductPrices(products, customPrices, 0);
    expect(result).toEqual([
      { id: "p1", price: 85 },
      { id: "p2", price: 50 },
    ]);
  });

  it("applies client-level discount percentage to all products", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 200)];
    const result = resolveProductPrices(products, [], 5);
    expect(result).toEqual([
      { id: "p1", price: 95 },
      { id: "p2", price: 190 },
    ]);
  });

  it("per-product custom price takes priority over discount percentage", () => {
    const products = [makeProduct("p1", 100), makeProduct("p2", 200)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p1", custom_price: 80 },
    ];
    const result = resolveProductPrices(products, customPrices, 5);
    expect(result).toEqual([
      { id: "p1", price: 80 },
      { id: "p2", price: 190 },
    ]);
  });

  it("handles zero discount percentage as no-op", () => {
    const products = [makeProduct("p1", 100)];
    const result = resolveProductPrices(products, [], 0);
    expect(result).toEqual([{ id: "p1", price: 100 }]);
  });

  it("rounds discount result to 2 decimal places", () => {
    const products = [makeProduct("p1", 99.99)];
    const result = resolveProductPrices(products, [], 2.5);
    expect(result).toEqual([{ id: "p1", price: 97.49 }]);
  });

  it("handles empty products array", () => {
    const result = resolveProductPrices([], [], 5);
    expect(result).toEqual([]);
  });

  it("ignores custom prices for products not in the array", () => {
    const products = [makeProduct("p1", 100)];
    const customPrices: CustomPriceEntry[] = [
      { product_id: "p-not-in-list", custom_price: 50 },
    ];
    const result = resolveProductPrices(products, customPrices, 0);
    expect(result).toEqual([{ id: "p1", price: 100 }]);
  });
});
