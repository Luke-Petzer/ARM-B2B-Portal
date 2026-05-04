/**
 * Structural tests for RefundRequest email templates.
 * Verifies both exports exist and contain required content markers.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/emails/RefundRequest.tsx"),
  "utf-8"
);

describe("RefundRequest email file", () => {
  it("exports BuyerRefundConfirmationEmail", () => {
    expect(source).toMatch(/export function BuyerRefundConfirmationEmail/);
  });

  it("exports BusinessRefundNotificationEmail", () => {
    expect(source).toMatch(/export function BusinessRefundNotificationEmail/);
  });

  it("BuyerRefundConfirmationEmail references Consumer Protection Act", () => {
    expect(source).toMatch(/Consumer Protection Act/);
  });

  it("BusinessRefundNotificationEmail references reasonLabel", () => {
    expect(source).toMatch(/reasonLabel/);
  });

  it("both templates accept orderReference prop", () => {
    const matches = source.match(/orderReference/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
