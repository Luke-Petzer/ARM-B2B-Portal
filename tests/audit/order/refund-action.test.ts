/**
 * Structural tests for submitRefundRequestAction.
 * Verifies auth check, ownership guard, and email isolation patterns.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/refund.ts"),
  "utf-8"
);

describe("submitRefundRequestAction — auth & ownership", () => {
  it("checks session before any DB call", () => {
    const sessionIndex = source.indexOf("getSession()");
    const dbIndex = source.indexOf("adminClient");
    expect(sessionIndex).toBeGreaterThan(-1);
    expect(dbIndex).toBeGreaterThan(-1);
    expect(sessionIndex).toBeLessThan(dbIndex);
  });

  it("verifies order belongs to the buyer via profile_id filter", () => {
    expect(source).toMatch(/\.eq\("profile_id", session\.profileId\)/);
  });

  it("uses Zod to validate reason enum", () => {
    expect(source).toMatch(/z\.enum\(\[/);
  });
});

describe("submitRefundRequestAction — email isolation", () => {
  it("email send uses .catch() — never awaited directly at top level", () => {
    expect(source).toMatch(/resend\.emails\.send\([\s\S]*?\)\.catch\(/);
  });

  it("never throws after an email send error", () => {
    expect(source).not.toMatch(/catch[\s\S]*?throw/);
  });
});

describe("submitRefundRequestAction — schema", () => {
  it("validates orderId as UUID", () => {
    expect(source).toMatch(/z\.string\(\)\.uuid\(\)/);
  });

  it("caps details at 1000 characters", () => {
    expect(source).toMatch(/max\(1000/);
  });
});
