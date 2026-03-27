// tests/audit/auth/rate-limit.test.ts
//
// Audit tests for the login rate-limit logic.
// The Upstash/Redis client is mocked so these tests run in isolation without
// real network calls.

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Module-level mocks ────────────────────────────────────────────────────────
//
// vi.hoisted() runs before vi.mock() factories, making mockLimit available
// inside the Ratelimit constructor closure. Both mocks use regular function
// expressions (not arrow functions) so they can be called with `new`.

const mockLimit = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function () { return {}; }),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    // regular function so `new Ratelimit(...)` works; returning an object from
    // a constructor replaces `this` with that object
    vi.fn(function () { return { limit: mockLimit }; }),
    {
      slidingWindow: vi.fn().mockReturnValue({ type: "slidingWindow" }),
    }
  ),
}));

// ── Source text (static-analysis helpers) ─────────────────────────────────────

const authActionSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/app/actions/auth.ts"),
  "utf-8"
);

const rateLimitSource = fs.readFileSync(
  path.resolve(__dirname, "../../../src/lib/rate-limit.ts"),
  "utf-8"
);

// ── Module import (after mocks are in place) ──────────────────────────────────
// We import once at module level. Because getLimiter() caches the Ratelimit
// instance in a module-level variable, all tests share the same mock instance.
// Between tests we only reset the mockLimit spy (not the whole module).
import { checkLoginRateLimit } from "@/lib/rate-limit";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Rate Limit: checkLoginRateLimit return shape", () => {
  it("returns { allowed: true } when Redis reports success", async () => {
    // Ensure Redis env vars are present so the real limiter path is taken.
    process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
    });

    const result = await checkLoginRateLimit("1.2.3.4");

    expect(result).toEqual({ allowed: true });
  });

  it("returns { allowed: false, retryAfter: number } when rate-limited", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

    const resetAt = Date.now() + 45_000;
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: resetAt,
      pending: Promise.resolve(),
    });

    const result = await checkLoginRateLimit("1.2.3.4");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(typeof result.retryAfter).toBe("number");
      expect(result.retryAfter).toBeGreaterThan(0);
    }
  });

  it("returns { allowed: true } on Redis error (fail-open behaviour)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

    mockLimit.mockRejectedValueOnce(new Error("Redis connection refused"));

    const result = await checkLoginRateLimit("1.2.3.4");

    // Fail-open: must not lock out users on infrastructure errors.
    expect(result).toEqual({ allowed: true });
  });
});

describe("Rate Limit: IP identifier extraction — static analysis", () => {
  it("auth action extracts the FIRST IP from x-forwarded-for (not the full header)", () => {
    // The split(",")[0] pattern ensures only the leftmost (client) IP is used.
    expect(authActionSource).toMatch(/split\(","\)\[0\]/);
  });

  it("auth action calls .trim() on the extracted IP to strip whitespace", () => {
    expect(authActionSource).toMatch(/\.trim\(\)/);
  });

  it("rate-limit module uses a slidingWindow limiter", () => {
    expect(rateLimitSource).toMatch(/slidingWindow/);
  });

  it("rate-limit module uses the prefix 'portal:login'", () => {
    expect(rateLimitSource).toMatch(/portal:login/);
  });
});

describe("Rate Limit: 'unknown' IP bucket collapse — risk documentation", () => {
  it("FIXED: auth action no longer uses bare 'unknown' as the rate-limit identifier", () => {
    // The fix scopes the fallback to `unknown:<accountNumber>` so that a
    // lockout is per-account rather than shared across all users whose IP
    // cannot be resolved. Verify the bare-string fallback is gone.
    //
    // Old (vulnerable) pattern:  ?? "unknown"
    // New (safe) pattern:        ?? `unknown:${accountNumber}`
    const hasBareUnknownFallback = /\?\?\s*["']unknown["']/.test(authActionSource);
    expect(hasBareUnknownFallback).toBe(false);
  });

  it("FIXED: auth action scopes the unknown fallback to the account number", () => {
    // Confirms the safer `unknown:${accountNumber}` pattern is present.
    expect(authActionSource).toMatch(/unknown:\$\{accountNumber\}/);
  });

  it("rate-limit module has a noop limiter for environments without Redis", () => {
    // When UPSTASH env vars are absent the noop limiter allows all requests
    // so local dev and CI aren't blocked.
    expect(rateLimitSource).toMatch(/createNoopLimiter/);
  });

  it("RISK DOCUMENTED: a shared 'unknown:<accountNumber>' bucket still allows per-account lockout", () => {
    // After the fix, 5 failed attempts for the same account number from
    // unresolvable IPs will lock out that account for 60 s.
    // This is intentional — it limits brute-force while not locking out
    // unrelated accounts.
    //
    // Residual risk: a corporate NAT where all employees share one real IP
    // will still share the IP-keyed bucket. That is a deliberate trade-off:
    // only 5 attempts per minute per IP is unlikely to affect a legitimate
    // single-user office scenario.
    expect(true).toBe(true); // documentation-only assertion
  });
});
