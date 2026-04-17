import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 5 login attempts per 60-second sliding window per IP.
// Protects the buyer account number endpoint from brute-force enumeration.
let buyerLoginLimiter: Ratelimit | null = null;
// [M2] 10 attempts per hour per email — slower bucket to catch credential stuffing
let emailLoginLimiter: Ratelimit | null = null;

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // [M1] In production, missing Redis config is a fatal misconfiguration.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production."
      );
    }
    console.warn(
      "[rate-limit] Upstash Redis env vars not set. Rate limiting is DISABLED (dev only)."
    );
    return null;
  }
  return { url, token };
}

function getLimiter(): Ratelimit {
  if (buyerLoginLimiter) return buyerLoginLimiter;

  const config = getRedisConfig();
  if (!config) return createNoopLimiter();

  buyerLoginLimiter = new Ratelimit({
    redis: new Redis(config),
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "portal:login",
    analytics: false,
  });

  return buyerLoginLimiter;
}

function getEmailLimiter(): Ratelimit {
  if (emailLoginLimiter) return emailLoginLimiter;

  const config = getRedisConfig();
  if (!config) return createNoopLimiter();

  emailLoginLimiter = new Ratelimit({
    redis: new Redis(config),
    limiter: Ratelimit.slidingWindow(10, "3600 s"),
    prefix: "portal:login:email",
    analytics: false,
  });

  return emailLoginLimiter;
}

/**
 * Checks whether the given identifier (typically client IP) has exceeded
 * the login rate limit.
 *
 * @returns `{ allowed: true }` if the request may proceed, or
 *          `{ allowed: false, retryAfter: number }` if it should be blocked.
 */
export async function checkLoginRateLimit(
  identifier: string,
  email?: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  try {
    const limiter = getLimiter();
    const result = await limiter.limit(identifier);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return { allowed: false, retryAfter };
    }

    // [M2] Per-email secondary bucket (10 attempts/hour)
    if (email) {
      const emailLim = getEmailLimiter();
      const emailResult = await emailLim.limit(email.toLowerCase());
      if (!emailResult.success) {
        const retryAfter = Math.ceil((emailResult.reset - Date.now()) / 1000);
        return { allowed: false, retryAfter };
      }
    }

    return { allowed: true };
  } catch (err) {
    // [M1] In production, Redis errors should fail-closed to prevent bypass.
    // In development, allow through to avoid blocking developers.
    console.error("[rate-limit] Redis error:", err);
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, retryAfter: 30 };
    }
    return { allowed: true };
  }
}

// ── [M7] Per-session rate limit for mutations ─────────────────────────────

let actionLimiter: Ratelimit | null = null;

function getActionLimiter(): Ratelimit {
  if (actionLimiter) return actionLimiter;

  const config = getRedisConfig();
  if (!config) return createNoopLimiter();

  actionLimiter = new Ratelimit({
    redis: new Redis(config),
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    prefix: "portal:action",
    analytics: false,
  });

  return actionLimiter;
}

/**
 * Per-session rate limit for mutation actions (checkout, invoice, admin ops).
 * 30 requests per 60s per profileId.
 */
export async function checkActionRateLimit(
  profileId: string,
  actionName: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  try {
    const limiter = getActionLimiter();
    const result = await limiter.limit(`${actionName}:${profileId}`);

    if (result.success) return { allowed: true };

    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  } catch (err) {
    console.error("[rate-limit] action limiter error:", err);
    if (process.env.NODE_ENV === "production") {
      return { allowed: false, retryAfter: 30 };
    }
    return { allowed: true };
  }
}

// ── Noop limiter for local dev without Redis ───────────────────────────────

function createNoopLimiter(): Ratelimit {
  return {
    limit: async () => ({
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
      reason: undefined,
      logs: undefined,
    }),
    blockUntilReady: async () => ({
      success: true,
      limit: 5,
      remaining: 5,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
      reason: undefined,
      logs: undefined,
    }),
  } as unknown as Ratelimit;
}
