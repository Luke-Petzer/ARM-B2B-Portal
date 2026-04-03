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

function mockSupabaseWithSignIn(result: { error: { message: string } | null }) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(result),
    },
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

  it("redirects on successful login", async () => {
    mockSupabaseWithSignIn({ error: null });
    const fd = makeFormData("test@example.com", "correctpassword");
    // redirect() throws REDIRECT error in tests (mocked in setup.ts)
    await expect(loginAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });
});
