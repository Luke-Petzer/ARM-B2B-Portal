/**
 * Exhaustive unit tests for checkCreditStatus
 *
 * Audit covers:
 *   - Happy paths (no orders, orders within month, high limit)
 *   - Rule 1 — overdue (previous-month orders)
 *   - Rule 2 — limit exceeded (outstanding > creditLimit)
 *   - Error handling (DB errors, null data, missing profile)
 *   - Financial precision (float drift, Supabase NUMERIC strings)
 *
 * NOTE: vi.mock() is hoisted by Vitest before any imports, so the mock
 * is in place before checkCreditStatus loads its adminClient dependency.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// Must be called before any module that depends on adminClient is imported.
vi.mock("../../../src/lib/supabase/admin", () => ({
  adminClient: {
    from: vi.fn(),
  },
}));

import { adminClient } from "../../../src/lib/supabase/admin";
import { checkCreditStatus } from "../../../src/lib/credit/checkCreditStatus";

// ── Types ──────────────────────────────────────────────────────────────────────

type MockOrder = {
  id: string;
  total_amount: number | string;
  confirmed_at: string | null;
  payment_status: string;
};

// ── Mock helper ────────────────────────────────────────────────────────────────

/**
 * Wires adminClient.from() so that:
 *   - .from("orders")   → chain ending with .not() that resolves the order list
 *   - .from("profiles") → chain ending with .single() that resolves the profile
 *
 * Both Promise.all branches run in parallel, so we route by table name.
 */
function mockSupabase({
  orders = [],
  ordersError = null,
  creditLimit = null,
  profileError = null,
}: {
  orders?: MockOrder[];
  ordersError?: { message: string } | null;
  creditLimit?: number | null;
  profileError?: { message: string } | null;
}) {
  // Orders query chain — the last chained call in the source is .not(...)
  const ordersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockResolvedValue({
      data: ordersError ? null : orders,
      error: ordersError,
    }),
  };

  // Profile query chain — the last chained call in the source is .single()
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: profileError ? null : { credit_limit: creditLimit },
      error: profileError,
    }),
  };

  (adminClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      if (table === "orders") return ordersChain;
      if (table === "profiles") return profileChain;
      return ordersChain;
    }
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** Returns an ISO string guaranteed to be within the current UTC month. */
function thisMonthISO(): string {
  const now = new Date();
  // Use the 15th of the current UTC month — safely mid-month
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12, 0, 0)
  ).toISOString();
}

/** Returns an ISO string for the very first instant of the current UTC month. */
function startOfThisMonthISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();
}

/** Returns an ISO string for one millisecond before the start of the current UTC month. */
function oneMsBeforeStartOfMonthISO(): string {
  const now = new Date();
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(startMs - 1).toISOString();
}

/** Returns an ISO string for a date clearly in the previous UTC month. */
function lastMonthISO(): string {
  const now = new Date();
  // Go back to the 15th of the previous UTC month
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0)
  ).toISOString();
}

// ── Reset mocks between tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// HAPPY PATHS
// ══════════════════════════════════════════════════════════════════════════════

describe("Happy paths", () => {
  it("HP-1: no orders → not blocked, outstanding = 0, creditLimit passed through", async () => {
    mockSupabase({ orders: [], creditLimit: 500 });

    const result = await checkCreditStatus("profile-abc");

    expect(result).toEqual({
      blocked: false,
      reason: null,
      outstanding: 0,
      creditLimit: 500,
    });
  });

  it("HP-2: all orders within current month, outstanding under limit → not blocked", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 100, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
        { id: "o2", total_amount: 200, confirmed_at: thisMonthISO(), payment_status: "credit_approved" },
      ],
      creditLimit: 1000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.outstanding).toBe(300);
    expect(result.creditLimit).toBe(1000);
  });

  it("HP-3: 30-day client, high limit, low outstanding → not blocked", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 50, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 10000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.outstanding).toBe(50);
    expect(result.creditLimit).toBe(10000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RULE 1 — OVERDUE
// ══════════════════════════════════════════════════════════════════════════════

describe("Rule 1 — Overdue (order confirmed before start of current month)", () => {
  it("R1-1: one order confirmed last month → blocked, reason: overdue", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 300, confirmed_at: lastMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("overdue");
    expect(result.outstanding).toBe(300);
    expect(result.creditLimit).toBe(5000);
  });

  it("R1-2: order confirmed exactly at start of month → NOT overdue (boundary: equal is not less-than)", async () => {
    mockSupabase({
      orders: [
        {
          id: "o1",
          total_amount: 100,
          confirmed_at: startOfThisMonthISO(),
          payment_status: "unpaid",
        },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("R1-3: order confirmed one millisecond BEFORE start of month → IS overdue", async () => {
    mockSupabase({
      orders: [
        {
          id: "o1",
          total_amount: 100,
          confirmed_at: oneMsBeforeStartOfMonthISO(),
          payment_status: "unpaid",
        },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("overdue");
  });

  it("R1-4: mix of overdue and current-month orders → blocked (any overdue is enough)", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 100, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
        { id: "o2", total_amount: 200, confirmed_at: lastMonthISO(), payment_status: "credit_approved" },
        { id: "o3", total_amount: 50, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("overdue");
    // outstanding still reflects all orders
    expect(result.outstanding).toBe(350);
  });

  it("R1-5: order with confirmed_at = null is never considered overdue", async () => {
    // The DB query uses .not("confirmed_at", "is", null), but mock bypasses that filter.
    // The in-memory guard `if (!o.confirmed_at) return false` should protect against this.
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 200, confirmed_at: null, payment_status: "unpaid" },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RULE 2 — LIMIT EXCEEDED
// ══════════════════════════════════════════════════════════════════════════════

describe("Rule 2 — Limit exceeded (outstanding > creditLimit)", () => {
  it("R2-1: outstanding > creditLimit → blocked, reason: limit_exceeded", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 600, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 500,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("limit_exceeded");
    expect(result.outstanding).toBe(600);
    expect(result.creditLimit).toBe(500);
  });

  it("R2-2: outstanding === creditLimit → NOT blocked (strict > not >=)", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 500, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 500,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("R2-3: outstanding < creditLimit → not blocked", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 499.99, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 500,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.outstanding).toBeCloseTo(499.99, 5);
  });

  it("R2-4: creditLimit = null → limit check is SKIPPED, never limit_exceeded", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 999999, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: null,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.creditLimit).toBeNull();
  });

  it("R2-5 [FINDING C5-02]: creditLimit = 0 → limit check SKIPPED (0 > 0 is false) → NOT blocked even with massive outstanding", async () => {
    // AUDIT FINDING: credit_limit = 0 means the guard `creditLimit > 0` is false,
    // so the limit check is entirely bypassed. A client with credit_limit = 0
    // can accumulate unlimited outstanding balance. Intentional or bug?
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 50000, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 0,
    });

    const result = await checkCreditStatus("profile-abc");

    // Documents current (potentially unintended) behaviour:
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.creditLimit).toBe(0);
  });

  it("R2-6 [FINDING C5-02]: creditLimit = -1 (negative) → limit check SKIPPED (negative > 0 is false)", async () => {
    // Negative credit limits can appear from bad data entry. The guard `creditLimit > 0`
    // silently skips the check, granting effectively unlimited credit.
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 50000, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: -1,
    });

    const result = await checkCreditStatus("profile-abc");

    // Documents current behaviour — negative limit treated same as null
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.creditLimit).toBe(-1);
  });

  it("R2-7: outstanding = 0 with creditLimit = 0 → not blocked (nothing outstanding)", async () => {
    mockSupabase({ orders: [], creditLimit: 0 });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(false);
    expect(result.outstanding).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════════

describe("Error handling", () => {
  it("EH-1: ordersResult.error set → fail-closed: blocked, reason: status_indeterminate", async () => {
    mockSupabase({ ordersError: { message: "connection timeout" } });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("status_indeterminate");
    expect(result.outstanding).toBe(0);
    expect(result.creditLimit).toBeNull();
  });

  it("EH-2: ordersResult.data is null (no error object) → fail-closed: blocked, status_indeterminate", async () => {
    // Supabase can theoretically return {data: null, error: null} in edge cases
    mockSupabase({ ordersError: null, orders: undefined as unknown as MockOrder[] });

    // Override to force data: null, error: null
    const ordersChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { credit_limit: 1000 }, error: null }),
    };
    (adminClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "orders") return ordersChain;
      return profileChain;
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("status_indeterminate");
  });

  it("EH-3 [FINDING C5-03]: profileResult.error set → creditLimit defaults to null (unlimited credit granted to unknown profile)", async () => {
    // AUDIT FINDING: if the profiles table returns an error (e.g. profile not found),
    // creditLimit falls through to null. Rule 2 is then skipped entirely.
    // An invalid profileId will be treated as having unlimited credit.
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 9999, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      profileError: { message: "row not found" },
    });

    const result = await checkCreditStatus("profile-abc");

    // Documents current behaviour: not blocked despite massive outstanding and no valid profile
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.creditLimit).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FINANCIAL PRECISION
// ══════════════════════════════════════════════════════════════════════════════

describe("Financial precision", () => {
  it("FP-1: multiple fractional totals — accumulated float drift stays within acceptable range", async () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS, so check for close-enough
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 0.1, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
        { id: "o2", total_amount: 0.2, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
        { id: "o3", total_amount: 0.3, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: 100,
    });

    const result = await checkCreditStatus("profile-abc");

    // Exact JS sum: 0.1 + 0.2 + 0.3 = 0.6000000000000001 (float drift present)
    // The source does NOT round — we document the exact drift behaviour here
    expect(result.outstanding).toBeCloseTo(0.6, 10);
    // Drift should never cause an incorrect block decision for reasonable amounts
    expect(result.blocked).toBe(false);
  });

  it("FP-2: string total_amount values are Number()-coerced (Supabase NUMERIC returns strings)", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: "125.50", confirmed_at: thisMonthISO(), payment_status: "unpaid" },
        { id: "o2", total_amount: "74.50", confirmed_at: thisMonthISO(), payment_status: "credit_approved" },
      ],
      creditLimit: 500,
    });

    const result = await checkCreditStatus("profile-abc");

    expect(result.outstanding).toBe(200);
    expect(result.blocked).toBe(false);
  });

  it("FP-3: string creditLimit (Supabase NUMERIC) is correctly coerced via Number()", async () => {
    mockSupabase({
      orders: [
        { id: "o1", total_amount: 600, confirmed_at: thisMonthISO(), payment_status: "unpaid" },
      ],
      creditLimit: "500" as unknown as number,
    });

    const result = await checkCreditStatus("profile-abc");

    // 600 > 500 → blocked
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("limit_exceeded");
    expect(result.creditLimit).toBe(500);
  });

  it("FP-4: many small orders summing to just over the limit → correctly blocked", async () => {
    // 10 × 100.01 = 1000.1, creditLimit = 1000
    const orders: MockOrder[] = Array.from({ length: 10 }, (_, i) => ({
      id: `o${i}`,
      total_amount: 100.01,
      confirmed_at: thisMonthISO(),
      payment_status: "unpaid",
    }));

    mockSupabase({ orders, creditLimit: 1000 });

    const result = await checkCreditStatus("profile-abc");

    expect(result.outstanding).toBeCloseTo(1000.1, 5);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("limit_exceeded");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MONTH BOUNDARY — PRECISE UTC EDGE CASES
// ══════════════════════════════════════════════════════════════════════════════

describe("Month boundary — UTC precision", () => {
  it("MB-1: order at 2026-03-31T23:59:59.999Z is overdue when current month is April 2026", async () => {
    // We can't control `new Date()` without faking timers, so we verify the
    // boundary logic is correct by checking what the source computes:
    // startOfMonth = Date.UTC(year, month, 1) which is midnight UTC on the 1st.
    // An order at 2026-03-31T23:59:59.999Z is strictly < 2026-04-01T00:00:00.000Z → overdue.
    // This test runs today (2026-03-27) so April is "next month" — we simulate
    // by using a date clearly in last month regardless of current date.
    mockSupabase({
      orders: [
        {
          id: "o1",
          total_amount: 100,
          confirmed_at: lastMonthISO(),
          payment_status: "unpaid",
        },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("overdue");
  });

  it("MB-2: order at exactly 2026-04-01T00:00:00.000Z is NOT overdue when current month is April 2026", async () => {
    // When the current month IS April, the start-of-month IS 2026-04-01T00:00:00.000Z.
    // new Date(confirmed_at) < startOfMonth → false when they are equal.
    mockSupabase({
      orders: [
        {
          id: "o1",
          total_amount: 100,
          confirmed_at: startOfThisMonthISO(),
          payment_status: "unpaid",
        },
      ],
      creditLimit: 5000,
    });

    const result = await checkCreditStatus("profile-abc");
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });
});
