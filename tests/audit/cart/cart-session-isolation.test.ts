import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockClearCart, mockGetState } = vi.hoisted(() => {
  const mockClearCart = vi.fn();
  const mockGetState = vi.fn(() => ({ clearCart: mockClearCart }));
  return { mockClearCart, mockGetState };
});

vi.mock("@/lib/cart/store", () => ({
  useCartStore: Object.assign(vi.fn(), { getState: mockGetState }),
}));

const sessionStorageMap = new Map<string, string>();
const mockSessionStorage = {
  getItem: vi.fn((key: string) => sessionStorageMap.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => sessionStorageMap.set(key, val)),
  removeItem: vi.fn((key: string) => sessionStorageMap.delete(key)),
  clear: vi.fn(() => sessionStorageMap.clear()),
  get length() { return sessionStorageMap.size; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "sessionStorage", { value: mockSessionStorage, writable: true });

import { renderCartGuardEffect } from "@/components/portal/CartGuard";

describe("CartGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMap.clear();
  });

  it("clears cart when session flag is absent (fresh login)", () => {
    renderCartGuardEffect();
    expect(mockClearCart).toHaveBeenCalledOnce();
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith("cart-session-active", "1");
  });

  it("does NOT clear cart when session flag is present (in-app navigation)", () => {
    sessionStorageMap.set("cart-session-active", "1");
    renderCartGuardEffect();
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it("sets session flag after clearing cart", () => {
    renderCartGuardEffect();
    expect(sessionStorageMap.get("cart-session-active")).toBe("1");
  });
});
