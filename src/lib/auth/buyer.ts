import "server-only";
import { jwtVerify } from "jose";
import { z } from "zod";
import type { AppRole } from "@/lib/supabase/types";

// ── Constants ──────────────────────────────────────────────────────────────

export const BUYER_SESSION_COOKIE = "sb-buyer-session";
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

