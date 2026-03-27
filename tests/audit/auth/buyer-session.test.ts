// tests/audit/auth/buyer-session.test.ts
//
// Audit tests for the buyer JWT session: creation, verification, and cookie options.
// `createBuyerSession` / `verifyBuyerSession` are pure functions (jose + env), so
// we can exercise them directly without HTTP infrastructure.

import { describe, it, expect, beforeEach } from "vitest";
import { jwtVerify, decodeJwt } from "jose";

// ── Secret that meets jose's HS256 minimum (≥ 32 bytes) ──────────────────────
const TEST_SECRET = "test-secret-32-chars-padded-to-32!!";
const OTHER_SECRET = "other-secret-32-chars-padded-0000";

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeSecret(s: string) {
  return new TextEncoder().encode(s);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
});

// ── Import module under test AFTER env is set ─────────────────────────────────
// Using dynamic import inside each test allows beforeEach to set the env first,
// but since the secret is read at call time (not module load time) a static
// import also works here. We use a static import for simplicity.
import {
  createBuyerSession,
  verifyBuyerSession,
  buyerSessionCookieOptions,
} from "@/lib/auth/buyer";

// ── createBuyerSession ────────────────────────────────────────────────────────

describe("createBuyerSession: JWT claim structure", () => {
  it("produces a valid HS256 JWT verifiable with the shared secret", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });

    // Should not throw — if signature is wrong jose throws JWSSignatureVerificationFailed
    const { payload } = await jwtVerify(token, encodeSecret(TEST_SECRET), {
      algorithms: ["HS256"],
    });

    expect(payload).toBeDefined();
  });

  it("sets sub to the profileId", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.sub).toBe("profile-uuid-1");
  });

  it("sets role claim to 'authenticated' (Supabase convention)", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.role).toBe("authenticated");
  });

  it("sets aud to 'authenticated'", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.aud).toBe("authenticated");
  });

  it("sets iss to 'supabase'", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.iss).toBe("supabase");
  });

  it("sets app_role to the supplied role ('buyer_default')", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.app_role).toBe("buyer_default");
  });

  it("sets account_number to the supplied value", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const payload = decodeJwt(token);
    expect(payload.account_number).toBe("RAS-00001");
  });

  it("sets exp approximately 24 hours from now", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const after = Math.floor(Date.now() / 1000);
    const payload = decodeJwt(token);

    const exp = payload.exp as number;
    const SESSION_SECONDS = 60 * 60 * 24;

    // exp must be within [before + 24h, after + 24h] with 2-second tolerance
    expect(exp).toBeGreaterThanOrEqual(before + SESSION_SECONDS - 2);
    expect(exp).toBeLessThanOrEqual(after + SESSION_SECONDS + 2);
  });

  it("sets iat to approximately now", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });
    const after = Math.floor(Date.now() / 1000);
    const payload = decodeJwt(token);
    const iat = payload.iat as number;

    expect(iat).toBeGreaterThanOrEqual(before - 1);
    expect(iat).toBeLessThanOrEqual(after + 1);
  });
});

// ── verifyBuyerSession ────────────────────────────────────────────────────────

describe("verifyBuyerSession: success path", () => {
  it("returns the correct payload for a freshly issued token", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });

    const session = await verifyBuyerSession(token);

    expect(session).not.toBeNull();
    expect(session!.profileId).toBe("profile-uuid-1");
    expect(session!.role).toBe("buyer_default");
    expect(session!.accountNumber).toBe("RAS-00001");
    expect(session!.token).toBe(token);
  });
});

describe("verifyBuyerSession: rejection paths", () => {
  it("returns null for a completely invalid string", async () => {
    const result = await verifyBuyerSession("not.a.jwt");
    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    // Issue a token with a different secret than the one in env
    const tamperedToken = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(OTHER_SECRET));

    const result = await verifyBuyerSession(tamperedToken);
    expect(result).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Build a token that expired 1 second ago
    const expiredToken = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
      iat: now - 7200,
      exp: now - 1, // already expired
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(encodeSecret(TEST_SECRET));

    const result = await verifyBuyerSession(expiredToken);
    expect(result).toBeNull();
  });

  it("returns null when sub claim is missing", async () => {
    // Craft a token without `sub`
    const tokenNoSub = await new (await import("jose")).SignJWT({
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(TEST_SECRET));

    const result = await verifyBuyerSession(tokenNoSub);
    expect(result).toBeNull();
  });

  it("returns null when app_role claim is missing", async () => {
    const tokenNoRole = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      account_number: "RAS-00001",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(TEST_SECRET));

    const result = await verifyBuyerSession(tokenNoRole);
    expect(result).toBeNull();
  });

  it("returns null when account_number claim is missing", async () => {
    const tokenNoAccount = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(TEST_SECRET));

    const result = await verifyBuyerSession(tokenNoAccount);
    expect(result).toBeNull();
  });

  it("returns null for a token where the payload has been tampered with (signature mismatch)", async () => {
    const token = await createBuyerSession({
      profileId: "profile-uuid-1",
      role: "buyer_default",
      accountNumber: "RAS-00001",
    });

    // Mutate the payload part (second segment)
    const [header, , sig] = token.split(".");
    const fakeClaims = Buffer.from(
      JSON.stringify({ sub: "attacker", app_role: "admin", account_number: "ATTACKER" })
    ).toString("base64url");

    const result = await verifyBuyerSession(`${header}.${fakeClaims}.${sig}`);
    expect(result).toBeNull();
  });
});

// ── buyerSessionCookieOptions ─────────────────────────────────────────────────

describe("buyerSessionCookieOptions: security properties", () => {
  it("httpOnly is always true (prevents JS access to the session cookie)", () => {
    expect(buyerSessionCookieOptions.httpOnly).toBe(true);
  });

  it("sameSite is 'lax' (allows top-level navigation, blocks cross-site POST)", () => {
    expect(buyerSessionCookieOptions.sameSite).toBe("lax");
  });

  it("path is '/' (cookie sent on all routes)", () => {
    expect(buyerSessionCookieOptions.path).toBe("/");
  });

  it("maxAge is exactly 86400 seconds (24 hours)", () => {
    expect(buyerSessionCookieOptions.maxAge).toBe(60 * 60 * 24);
  });

  it("secure flag is tied to NODE_ENV=production (RISK: must be verified at deploy time)", () => {
    // In production NODE_ENV the secure flag must be true — the cookie must
    // only travel over HTTPS. If the portal is accessed over http:// in prod,
    // the browser silently drops the cookie and the session is never established.
    //
    // This test documents the coupling; the operator must ensure TLS is
    // enforced at the edge (load balancer / CDN) before traffic reaches Next.js.
    const isProduction = process.env.NODE_ENV === "production";
    expect(buyerSessionCookieOptions.secure).toBe(isProduction);
  });
});
