// tests/audit/auth/account-number-validation.test.ts
//
// Audit tests for buyer account number format validation.
// Tests both `validateAccountNumber` (the public helper) and the raw
// `accountNumberSchema` zod schema directly.

import { describe, it, expect } from "vitest";
import { validateAccountNumber, accountNumberSchema } from "@/lib/auth/buyer";

// ── Valid formats ─────────────────────────────────────────────────────────────

describe("Account number: valid formats", () => {
  const valid = [
    "RAS-00001",
    "ABC001",
    "ZA-BUYER-99",
    "A1B",          // minimum 3 chars
    "A".repeat(20), // maximum 20 chars, all same letter
    "A1",           // wait — 2 chars should fail; covered in boundary tests below
    "AB1",          // exactly 3 chars
    "X0X",
    "AA-BB",
    "12345",
    "A1-B2-C3",
  ];

  // Keep only those that actually satisfy the regex to avoid false failures.
  // (The regex requires: start+end are [A-Z0-9], middle [A-Z0-9-]{1,18})
  const trulyValid = valid.filter((v) => {
    // A string must be 3-20 chars and match the pattern after uppercasing.
    if (v.length < 3 || v.length > 20) return false;
    return /^[A-Z0-9][A-Z0-9\-]{1,18}[A-Z0-9]$/.test(v.toUpperCase());
  });

  it.each(trulyValid)("'%s' passes validation", (acct) => {
    const result = validateAccountNumber(acct);
    expect(result.success).toBe(true);
  });
});

describe("Account number: specific representative valid cases", () => {
  it("RAS-00001 is valid", () => {
    expect(validateAccountNumber("RAS-00001").success).toBe(true);
  });

  it("ABC001 is valid", () => {
    expect(validateAccountNumber("ABC001").success).toBe(true);
  });

  it("ZA-BUYER-99 is valid", () => {
    expect(validateAccountNumber("ZA-BUYER-99").success).toBe(true);
  });
});

// ── Length boundary ───────────────────────────────────────────────────────────

describe("Account number: length boundaries", () => {
  it("exactly 3 characters passes (minimum boundary)", () => {
    // 'A1B' — [A-Z0-9] + one middle char [A-Z0-9] + [A-Z0-9]
    expect(validateAccountNumber("A1B").success).toBe(true);
  });

  it("exactly 20 characters passes (maximum boundary)", () => {
    // Construct a valid 20-char string: A + 18 middle chars + B
    const value = "A" + "1".repeat(18) + "B"; // 20 chars
    expect(value).toHaveLength(20);
    expect(validateAccountNumber(value).success).toBe(true);
  });

  it("2 characters fails (below minimum)", () => {
    expect(validateAccountNumber("AB").success).toBe(false);
  });

  it("1 character fails", () => {
    expect(validateAccountNumber("A").success).toBe(false);
  });

  it("empty string fails", () => {
    expect(validateAccountNumber("").success).toBe(false);
  });

  it("21 characters fails (above maximum)", () => {
    const value = "A" + "1".repeat(19) + "B"; // 21 chars
    expect(value).toHaveLength(21);
    expect(validateAccountNumber(value).success).toBe(false);
  });

  it("50 characters fails", () => {
    expect(validateAccountNumber("A".repeat(50)).success).toBe(false);
  });
});

// ── Case handling ─────────────────────────────────────────────────────────────

describe("Account number: case normalisation", () => {
  it("lowercase input is accepted and normalised to uppercase", () => {
    // 'ras-00001' should pass after toUpperCase() → 'RAS-00001'
    const result = validateAccountNumber("ras-00001");
    expect(result.success).toBe(true);
  });

  it("mixed-case input is accepted", () => {
    expect(validateAccountNumber("Ras-00001").success).toBe(true);
  });

  it("schema trims surrounding whitespace before validation", () => {
    // The schema applies .trim() so padded input should still validate.
    const result = accountNumberSchema.safeParse("  RAS-00001  ");
    expect(result.success).toBe(true);
  });
});

// ── Invalid characters ────────────────────────────────────────────────────────

describe("Account number: invalid special characters", () => {
  it("exclamation mark (!) fails", () => {
    expect(validateAccountNumber("RAS!001").success).toBe(false);
  });

  it("at-sign (@) fails", () => {
    expect(validateAccountNumber("RAS@001").success).toBe(false);
  });

  it("space in the middle fails", () => {
    expect(validateAccountNumber("RAS 001").success).toBe(false);
  });

  it("underscore (_) fails", () => {
    expect(validateAccountNumber("RAS_001").success).toBe(false);
  });

  it("dot (.) fails", () => {
    expect(validateAccountNumber("RAS.001").success).toBe(false);
  });

  it("forward slash (/) fails", () => {
    expect(validateAccountNumber("RAS/001").success).toBe(false);
  });

  it("leading hyphen fails (first char must be [A-Z0-9])", () => {
    expect(validateAccountNumber("-RAS001").success).toBe(false);
  });

  it("trailing hyphen fails (last char must be [A-Z0-9])", () => {
    expect(validateAccountNumber("RAS001-").success).toBe(false);
  });
});

// ── Regex structure guard ─────────────────────────────────────────────────────

describe("Account number: schema structure (static analysis)", () => {
  it("schema rejects strings shorter than 3 chars via .min()", () => {
    const result = accountNumberSchema.safeParse("AB");
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should report a length or format error, not a runtime exception
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("schema rejects strings longer than 20 chars via .max()", () => {
    const result = accountNumberSchema.safeParse("A".repeat(21));
    expect(result.success).toBe(false);
  });

  it("validateAccountNumber normalises the input to uppercase before validation", () => {
    // Internal toUpperCase() call means lowercase passes
    const lower = validateAccountNumber("abc001");
    const upper = validateAccountNumber("ABC001");
    expect(lower.success).toBe(upper.success);
  });
});
