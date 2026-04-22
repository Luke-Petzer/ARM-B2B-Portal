// tests/audit/auth/buyer-session.test.ts
//
// Audit tests for the buyer JWT session verification.
// After M3 remediation, session creation is handled by Supabase Auth;
// only `verifyBuyerSession` remains as a local function.

import { describe, it, expect, beforeEach } from "vitest";

// ── Secret that meets jose's HS256 minimum (>= 32 bytes) ──────────────────
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
import { verifyBuyerSession } from "@/lib/auth/buyer";

// ── verifyBuyerSession: rejection paths ──────────────────────────────────────

describe("verifyBuyerSession: rejection paths", () => {
  it("returns null for a completely invalid string", async () => {
    const result = await verifyBuyerSession("not.a.jwt");
    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
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
    const expiredToken = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
      iat: now - 7200,
      exp: now - 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(encodeSecret(TEST_SECRET));

    const result = await verifyBuyerSession(expiredToken);
    expect(result).toBeNull();
  });

  it("returns null when sub claim is missing", async () => {
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
    // Build a valid token, then tamper with the payload segment
    const validToken = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(TEST_SECRET));

    const [header, , sig] = validToken.split(".");
    const fakeClaims = Buffer.from(
      JSON.stringify({ sub: "attacker", app_role: "admin", account_number: "ATTACKER" })
    ).toString("base64url");

    const result = await verifyBuyerSession(`${header}.${fakeClaims}.${sig}`);
    expect(result).toBeNull();
  });
});

// ── verifyBuyerSession: success path ─────────────────────────────────────────

describe("verifyBuyerSession: success path", () => {
  it("returns the correct payload for a valid token", async () => {
    const token = await new (await import("jose")).SignJWT({
      sub: "profile-uuid-1",
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      app_role: "buyer_default",
      account_number: "RAS-00001",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(encodeSecret(TEST_SECRET));

    const session = await verifyBuyerSession(token);

    expect(session).not.toBeNull();
    expect(session!.profileId).toBe("profile-uuid-1");
    expect(session!.role).toBe("buyer_default");
    expect(session!.accountNumber).toBe("RAS-00001");
    expect(session!.token).toBe(token);
  });
});
