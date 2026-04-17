"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { BUYER_SESSION_COOKIE } from "@/lib/auth/buyer";
import { checkLoginRateLimit } from "@/lib/rate-limit";

// ── Shared error response type ─────────────────────────────────────────────

export interface AuthActionResult {
  error: string | null;
}

// ── Validation schemas ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = z.object({
  contact_name: z.string().trim().min(1, "Contact name is required."),
  business_name: z.string().trim().optional(),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

// ── Buyer login (email + password via Supabase Auth) ──────────────────────

export async function loginAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const headerStore = await headers();
  const rawIp =
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${email}`;
  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please verify your email address before signing in." };
    }
    return { error: "Invalid email or password." };
  }

  // Check role to route admins to the admin portal, buyers to the dashboard
  const { data: { user } } = await supabase.auth.getUser();

  // [H4] Defensive email verification check — don't rely solely on Supabase
  // project settings. If email_confirmed_at is null, sign out immediately.
  if (user && !user.email_confirmed_at) {
    await supabase.auth.signOut();
    return { error: "Please verify your email address before signing in." };
  }

  if (user) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (profile?.role === "admin") {
      redirect("/admin");
    }
  }

  redirect("/dashboard");
}

// ── Self-registration ──────────────────────────────────────────────────────

export async function signUpAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    contact_name: formData.get("contact_name"),
    business_name: formData.get("business_name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { contact_name, business_name, email, password } = parsed.data;

  const headerStore = await headers();
  const rawIp =
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${email}`;
  const rateLimit = await checkLoginRateLimit(`signup:${ip}`);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/verify-success`,
      data: {
        role: "buyer_default",
        contact_name,
        business_name: business_name ?? "",
      },
    },
  });

  if (error || !data.user) {
    return { error: "Registration failed. Please try again." };
  }

  // Don't redirect — user must verify email before logging in
  return { error: null };
}

// ── Forgot password ────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const headerStore = await headers();
  const rawIp =
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${parsed.data.email}`;
  const rateLimit = await checkLoginRateLimit(`forgot:${ip}`);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  const supabase = await createClient();
  // Always return success — don't reveal whether email exists
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  return { error: null };
}

// ── Reset password (after clicking email link) ─────────────────────────────

export async function resetPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Failed to update password. Please request a new reset link." };
  }

  redirect("/login");
}

// ── Admin login (unchanged) ────────────────────────────────────────────────

const adminLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

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

  const headerStore = await headers();
  const rawIp =
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${email}`;
  const rateLimit = await checkLoginRateLimit(`admin:${ip}`);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Invalid email or password." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication failed." };

  // [H4] Defensive email verification check
  if (!user.email_confirmed_at) {
    await supabase.auth.signOut();
    return { error: "Please verify your email address before signing in." };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();

  // Clear buyer JWT cookie if present (legacy custom-JWT buyers)
  const buyerCookie = cookieStore.get(BUYER_SESSION_COOKIE);
  if (buyerCookie) {
    cookieStore.delete(BUYER_SESSION_COOKIE);
  }

  // Clear Supabase Auth session (Supabase Auth buyers + admins)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}
