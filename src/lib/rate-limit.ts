import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 5 login attempts per 60-second sliding window per IP.
// Protects the buyer account number endpoint from brute-force enumeration.
let buyerLoginLimiter: Ratelimit | null = null;

function getLimiter(): Ratelimit {
  if (buyerLoginLimiter) return buyerLoginLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Graceful degradation: if Redis is not configured, skip rate limiting.
    // Log the warning — do not block legitimate logins.
    console.warn(
      "[rate-limit] Upstash Redis env vars not set. Rate limiting is DISABLED."
    );
    return createNoopLimiter();
  }

  buyerLoginLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "portal:login",
    analytics: false,
  });

  return buyerLoginLimiter;
}

/**
 * Checks whether the given identifier (typically client IP) has exceeded
 * the login rate limit.
 *
 * @returns `{ allowed: true }` if the request may proceed, or
 *          `{ allowed: false, retryAfter: number }` if it should be blocked.
 */
export async function checkLoginRateLimit(
  identifier: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  try {
    const limiter = getLimiter();
    const result = await limiter.limit(identifier);

    if (result.success) return { allowed: true };

    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return { allowed: false, retryAfter };
  } catch (err) {
    // Redis error — log and allow the request through to avoid locking out users.
    console.error("[rate-limit] Redis error, allowing request:", err);
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
