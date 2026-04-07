// tests/audit/auth/session-isBuyer.test.ts
//
// Verifies getSession() correctly identifies Supabase Auth buyers
// (isBuyer = true) vs admins (isBuyer = false).

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks must be hoisted before imports ──────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function mockCookieStore(buyerCookie?: string) {
  return {
    get: vi.fn((name: string) => {
      if (name === "sb-buyer-session" && buyerCookie) {
        return { value: buyerCookie };
      }
      return undefined;
    }),
  } as any;
}

function mockSupabaseClient(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

function mockAdminClientProfile(profile: {
  id: string;
  role: string;
  account_number: string | null;
  admin_role: string | null;
}) {
  (adminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile }),
  });
}

describe("getSession: isBuyer for Supabase Auth users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SUPER_EMAIL = "";
  });

  it("sets isBuyer=true and isAdmin=false for a buyer_default Supabase Auth user", async () => {
    const cookieStore = mockCookieStore(); // no custom buyer cookie
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient({ id: "user-uuid-1", email: "buyer@example.com" })
    );
    mockAdminClientProfile({
      id: "user-uuid-1",
      role: "buyer_default",
      account_number: null,
      admin_role: null,
    });

    const session = await getSession(cookieStore);

    expect(session).not.toBeNull();
    expect(session!.isBuyer).toBe(true);
    expect(session!.isAdmin).toBe(false);
    expect(session!.role).toBe("buyer_default");
  });

  it("sets isBuyer=false and isAdmin=true for an admin Supabase Auth user", async () => {
    const cookieStore = mockCookieStore();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient({ id: "admin-uuid-1", email: "admin@example.com" })
    );
    mockAdminClientProfile({
      id: "admin-uuid-1",
      role: "admin",
      account_number: null,
      admin_role: "manager",
    });

    const session = await getSession(cookieStore);

    expect(session).not.toBeNull();
    expect(session!.isBuyer).toBe(false);
    expect(session!.isAdmin).toBe(true);
  });

  it("returns null when no cookie and no Supabase Auth user", async () => {
    const cookieStore = mockCookieStore();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient(null)
    );

    const session = await getSession(cookieStore);

    expect(session).toBeNull();
  });
});
