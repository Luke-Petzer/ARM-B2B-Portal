import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { AppRole } from "@/lib/supabase/types";

// ── Constants ──────────────────────────────────────────────────────────────

export const BUYER_SESSION_COOKIE = "sb-buyer-session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24; // 24 hours

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("Missing env var: SUPABASE_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

// ── Validation ─────────────────────────────────────────────────────────────

// Account numbers: 3–20 uppercase alphanumeric characters, optionally separated by hyphens.
// Examples: RAS-00123, ACC001, ZA-BUYER-99
export const accountNumberSchema = z
  .string()
  .trim()
  .min(3, "Account number must be at least 3 characters")
  .max(20, "Account number must be at most 20 characters")
  .regex(
    /^[A-Z0-9][A-Z0-9\-]{1,18}[A-Z0-9]$/,
    "Invalid account number format"
  );

export function validateAccountNumber(input: string) {
  return accountNumberSchema.safeParse(input.toUpperCase());
}

// ── Session payload ────────────────────────────────────────────────────────

export interface BuyerSessionPayload {
  profileId: string;
  role: AppRole;
  accountNumber: string;
}

// ── JWT creation ───────────────────────────────────────────────────────────

/**
 * Creates a signed JWT compatible with Supabase's auth.uid() resolution.
 *
 * Critical claims:
 *   sub        = profile.id  → Supabase resolves auth.uid() from this
 *   role       = "authenticated" → Required for RLS policies to activate
 *   aud        = "authenticated" → Required by Supabase JWT validation
 *   app_role   = buyer role  → Read by get_app_role() SQL helper
 */
export async function createBuyerSession(
  payload: BuyerSessionPayload
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: payload.profileId,
    role: "authenticated",
    aud: "authenticated",
    iss: "supabase",
    app_role: payload.role,
    account_number: payload.accountNumber,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(getJwtSecret());
}

// ── JWT verification ───────────────────────────────────────────────────────

export interface VerifiedBuyerSession {
  profileId: string;
  role: AppRole;
  accountNumber: string;
  token: string; // raw JWT, forwarded to Supabase client as Authorization header
}

export async function verifyBuyerSession(
  token: string
): Promise<VerifiedBuyerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.app_role !== "string" ||
      typeof payload.account_number !== "string"
    ) {
      return null;
    }

    return {
      profileId: payload.sub,
      role: payload.app_role as AppRole,
      accountNumber: payload.account_number,
      token,
    };
  } catch {
    // Token is expired, malformed, or has an invalid signature.
    return null;
  }
}

// ── Cookie options ─────────────────────────────────────────────────────────

export const buyerSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
