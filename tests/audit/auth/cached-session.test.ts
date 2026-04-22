import { describe, it, expect, vi } from "vitest";

// Track how many times the underlying session resolution runs
let sessionResolutionCount = 0;

// Mock Supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                id: "profile-1",
                role: "buyer_default",
                account_number: "ACC-001",
                admin_role: null,
              },
              error: null,
            }),
        }),
      }),
    }),
  },
}));

// Mock Supabase server client — track getUser calls
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => {
        sessionResolutionCount++;
        return {
          data: {
            user: {
              id: "user-1",
              email: "buyer@test.com",
              email_confirmed_at: "2026-01-01T00:00:00Z",
            },
          },
        };
      }),
      signOut: vi.fn(),
    },
  })),
}));

// Must import AFTER mocks are set up
const { getSession } = await import("@/lib/auth/session");

describe("getSession caching", () => {
  it("deduplicates supabase.auth.getUser across concurrent calls", async () => {
    sessionResolutionCount = 0;

    // Simulate layout + page + component all calling getSession() concurrently
    const [session1, session2, session3] = await Promise.all([
      getSession(),
      getSession(),
      getSession(),
    ]);

    // All three should return the same resolved session
    expect(session1).not.toBeNull();
    expect(session1!.profileId).toBe("profile-1");
    expect(session1!.role).toBe("buyer_default");

    expect(session2).not.toBeNull();
    expect(session2!.profileId).toBe(session1!.profileId);

    expect(session3).not.toBeNull();
    expect(session3!.profileId).toBe(session1!.profileId);

    // The underlying supabase.auth.getUser() should only be called ONCE
    // because React cache() deduplicates within the same request
    expect(sessionResolutionCount).toBe(1);
  });
});
