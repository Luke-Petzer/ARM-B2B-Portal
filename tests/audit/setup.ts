// tests/audit/setup.ts
import { vi } from "vitest";

// Mock React's cache() — memoizes zero-arg functions within a test.
// Mirrors the real per-request deduplication in the React server runtime.
// Each call to cache() creates one memoized slot; the slot persists for
// the lifetime of the module (same as React's per-request scope).
vi.mock("react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => {
      let pending: Promise<unknown> | null = null;
      return ((...args: unknown[]) => {
        if (pending) return pending;
        const result = fn(...args);
        if (result instanceof Promise) {
          pending = result;
          // Reset after the promise settles so subsequent test calls get fresh results
          result.finally(() => { pending = null; });
          return result;
        }
        return result;
      }) as unknown as T;
    },
  };
});

// Mock Next.js server modules that throw outside the Next.js runtime
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
}));
