"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  validateAccountNumber,
  createBuyerSession,
  BUYER_SESSION_COOKIE,
  buyerSessionCookieOptions,
} from "@/lib/auth/buyer";
import { checkLoginRateLimit } from "@/lib/rate-limit";

// ── Shared error response type ─────────────────────────────────────────────

export interface AuthActionResult {
  error: string | null;
}

// ── Buyer login ────────────────────────────────────────────────────────────

const buyerLoginSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required")
    .transform((v) => v.toUpperCase()),
});

/**
 * Authenticates a buyer by account number.
 * Flow: validate format → rate limit → query DB → issue JWT cookie → redirect
 */
export async function buyerLoginAction(
  formData: FormData
): Promise<AuthActionResult> {
  // 1. Validate input format
  const parsed = buyerLoginSchema.safeParse({
    accountNumber: formData.get("accountNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { accountNumber } = parsed.data;

  // Further validate account number format
  const formatCheck = validateAccountNumber(accountNumber);
  if (!formatCheck.success) {
    // Return a generic message — don't leak format details to attackers
    return { error: "Invalid account number." };
  }

  // 2. Rate limit by IP (with account-number fallback to prevent bucket collapse)
  //
  // SECURITY NOTE: When x-forwarded-for is absent (corporate NAT/VPN/privacy
  // proxy strips the header), every user resolves to the literal string "unknown".
  // A single user making 5 failed attempts would exhaust the shared
  // "portal:login:unknown" bucket and lock out ALL other users whose IP is
  // also unresolvable — a global denial-of-service via rate-limit collapse.
  //
  // Fix: scope the fallback key to the validated account number so that a
  // lockout is confined to the specific account being targeted, not every user
  // on the same privacy tool or corporate egress point.
  const headerStore = await headers();
  const rawIp =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${accountNumber}`;

  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  // 3. Look up the profile (service role — bypasses RLS so we can find any active buyer)
  const { data: profile, error: dbError } = await adminClient
    .from("profiles")
    .select("id, role, account_number, business_name, is_active")
    .eq("account_number", accountNumber)
    .eq("is_active", true)
    .single();

  if (dbError || !profile) {
    // Deliberately vague — don't confirm or deny whether an account exists
    return { error: "Account not found or inactive." };
  }

  // 4. Verify this is actually a buyer account (admins authenticate differently)
  if (profile.role === "admin") {
    return { error: "Account not found or inactive." };
  }

  // 5. Create the custom JWT and set it as an HTTP-only cookie
  const token = await createBuyerSession({
    profileId: profile.id,
    role: profile.role,
    accountNumber: profile.account_number!,
  });

  const cookieStore = await cookies();
  cookieStore.set(BUYER_SESSION_COOKIE, token, buyerSessionCookieOptions);

  // 6. Redirect to the portal dashboard
  redirect("/dashboard");
}

// ── Admin login ────────────────────────────────────────────────────────────

const adminLoginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Authenticates an admin using Supabase Auth (email + password).
 * The @supabase/ssr client automatically manages the session cookie.
 */
export async function adminLoginAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Invalid email or password." };
  }

  // Verify this Supabase Auth user is actually an admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication failed." };
  }

  // Use adminClient (service role) to bypass RLS on profiles.
  // The standard SSR client JWT won't have an app_role claim for users
  // created via the Supabase dashboard, causing both RLS SELECT policies to fail.
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    // Sign out immediately — this is a buyer account trying to use the admin endpoint
    await supabase.auth.signOut();
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}

// ── Logout ─────────────────────────────────────────────────────────────────

/**
 * Clears the active session for both buyers (cookie) and admins (Supabase Auth).
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();

  // Clear buyer JWT cookie if present
  const buyerCookie = cookieStore.get(BUYER_SESSION_COOKIE);
  if (buyerCookie) {
    cookieStore.delete(BUYER_SESSION_COOKIE);
  }

  // Clear Supabase Auth session if present (admin)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}
