// tests/audit/auth/login-action.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { from: vi.fn() },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkLoginRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

import { loginAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabaseWithSignIn(
  result: { error: { message: string } | null },
  userId: string | null = null
) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(result),
      getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
    },
  });
}

import { adminClient } from "@/lib/supabase/admin";

function mockAdminClientWithRole(userId: string, role: string) {
  (adminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role } }),
  });
}

function makeFormData(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("loginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error for missing email", async () => {
    const fd = makeFormData("", "password123");
    const result = await loginAction(fd);
    expect(result?.error).toBeTruthy();
    expect(result?.error).toMatch(/email/i);
  });

  it("returns error for missing password", async () => {
    const fd = makeFormData("test@example.com", "");
    const result = await loginAction(fd);
    expect(result?.error).toBeTruthy();
  });

  it("returns error when Supabase Auth signIn fails", async () => {
    mockSupabaseWithSignIn({ error: { message: "Invalid login credentials" } });
    const fd = makeFormData("test@example.com", "wrongpassword");
    const result = await loginAction(fd);
    expect(result?.error).toBe("Invalid email or password.");
  });

  it("redirects buyer to /dashboard on successful login", async () => {
    mockSupabaseWithSignIn({ error: null }, "buyer-user-id");
    mockAdminClientWithRole("buyer-user-id", "buyer_default");
    const fd = makeFormData("test@example.com", "correctpassword");
    await expect(loginAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("redirects admin to /admin on successful login", async () => {
    mockSupabaseWithSignIn({ error: null }, "admin-user-id");
    mockAdminClientWithRole("admin-user-id", "admin");
    const fd = makeFormData("admin@example.com", "correctpassword");
    await expect(loginAction(fd)).rejects.toThrow("REDIRECT:/admin");
  });
});
