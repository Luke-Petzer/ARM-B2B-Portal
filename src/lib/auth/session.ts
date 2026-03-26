import "server-only";
import { cookies } from "next/headers";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { verifyBuyerSession, BUYER_SESSION_COOKIE } from "./buyer";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";

export interface ActiveSession {
  profileId: string;
  role: AppRole;
  accountNumber: string | null; // null for admins
  isBuyer: boolean;
  isAdmin: boolean;
  /** Sub-role for admin users — null for buyers */
  adminRole: "manager" | "employee" | null;
  /** True if the logged-in user's email matches ADMIN_SUPER_EMAIL */
  isSuperAdmin: boolean;
  /** Raw JWT for forwarding to a custom Supabase client if needed */
  token: string | null;
}

/**
 * Resolves the active session from either:
 *   1. A buyer custom JWT cookie  (sb-buyer-session)
 *   2. A Supabase Auth admin session cookie (set by @supabase/ssr)
 *
 * Returns null if the user is not authenticated.
 * Safe to call from Server Components, Server Actions, and Route Handlers.
 */
export async function getSession(
  cookieStore?: ReadonlyRequestCookies
): Promise<ActiveSession | null> {
  const store = cookieStore ?? (await cookies());

  // 1. Check buyer JWT first (buyers don't have Supabase Auth sessions)
  const buyerCookie = store.get(BUYER_SESSION_COOKIE);
  if (buyerCookie?.value) {
    const session = await verifyBuyerSession(buyerCookie.value);
    if (session) {
      return {
        profileId: session.profileId,
        role: session.role,
        accountNumber: session.accountNumber,
        isBuyer: true,
        isAdmin: false,
        adminRole: null,
        isSuperAdmin: false,
        token: session.token,
      };
    }
  }

  // 2. Fall back to Supabase Auth session (admins)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Use adminClient (service role) to bypass RLS on profiles.
    // Supabase Auth dashboard users don't have app_role in their JWT, so both
    // RLS SELECT policies evaluate to false/null for admin accounts.
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role, account_number, admin_role")
      .eq("auth_user_id", user.id)
      .single();

    if (profile) {
      const superEmail = process.env.ADMIN_SUPER_EMAIL;
      return {
        profileId: profile.id,
        role: profile.role,
        accountNumber: profile.account_number,
        isBuyer: false,
        isAdmin: profile.role === "admin",
        adminRole: profile.admin_role ?? "employee",
        isSuperAdmin: !!superEmail && user.email === superEmail,
        token: null,
      };
    }
  }

  return null;
}
