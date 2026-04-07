// tests/audit/auth/signup-action.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { from: vi.fn() },
}));

import { signUpAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabaseWithSignUp(result: {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue(result),
    },
  });
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("signUpAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when contact name is missing", async () => {
    const fd = makeFormData({ contact_name: "", email: "a@b.com", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/contact name/i);
  });

  it("returns error when email is invalid", async () => {
    const fd = makeFormData({ contact_name: "John", email: "not-an-email", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/email/i);
  });

  it("returns error when password is too short", async () => {
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "short" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/password/i);
  });

  it("returns error when Supabase signUp fails", async () => {
    mockSupabaseWithSignUp({ data: { user: null }, error: { message: "Email already in use" } });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toBeTruthy();
  });

  it("redirects to dashboard on successful signup", async () => {
    mockSupabaseWithSignUp({ data: { user: { id: "new-uuid" } }, error: null });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123" });
    await expect(signUpAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("allows empty business name (individuals)", async () => {
    mockSupabaseWithSignUp({ data: { user: { id: "new-uuid" } }, error: null });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123", business_name: "" });
    // Should not return a business name validation error
    await expect(signUpAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });
});
