import { describe, it, expect } from "vitest";
import { resolveProductPrices, type CustomPriceEntry } from "../../../src/lib/pricing/resolveClientPricing";
import { computeLineItem, type DbProductPricing } from "../../../src/lib/checkout/pricing";

describe("pricing pipeline with custom prices", () => {
  it("custom price flows through to computeLineItem correctly", () => {
    const products = [{ id: "p1", price: 100 }];
    const customPrices: CustomPriceEntry[] = [{ product_id: "p1", custom_price: 85 }];
    const resolved = resolveProductPrices(products, customPrices, 0);

    const dbProduct: DbProductPricing = {
      price: resolved[0].price,
      cost_price: 60,
      pack_size: 1,
      discount_type: null,
      discount_threshold: null,
      discount_value: null,
    };

    const lineItem = computeLineItem(dbProduct, 3);
    expect(lineItem.effectiveUnitPrice).toBe(85);
    expect(lineItem.lineTotal).toBe(255);
  });

  it("custom price + bulk discount compound correctly", () => {
    const products = [{ id: "p1", price: 100 }];
    const customPrices: CustomPriceEntry[] = [{ product_id: "p1", custom_price: 90 }];
    const resolved = resolveProductPrices(products, customPrices, 0);

    const dbProduct: DbProductPricing = {
      price: resolved[0].price,
      cost_price: 60,
      pack_size: 1,
      discount_type: "percentage",
      discount_threshold: 5,
      discount_value: 10,
    };

    const lineItem = computeLineItem(dbProduct, 5);
    expect(lineItem.effectiveUnitPrice).toBe(81);
    expect(lineItem.lineTotal).toBe(405);
  });

  it("client discount % + bulk discount compound correctly", () => {
    const products = [{ id: "p1", price: 100 }];
    const resolved = resolveProductPrices(products, [], 5);

    const dbProduct: DbProductPricing = {
      price: resolved[0].price,
      cost_price: 60,
      pack_size: 1,
      discount_type: "percentage",
      discount_threshold: 5,
      discount_value: 10,
    };

    const lineItem = computeLineItem(dbProduct, 5);
    expect(lineItem.effectiveUnitPrice).toBe(85.5);
    expect(lineItem.lineTotal).toBe(427.5);
  });
});
