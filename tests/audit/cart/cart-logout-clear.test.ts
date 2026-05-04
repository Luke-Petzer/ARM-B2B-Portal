import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockClearCart, mockGetState } = vi.hoisted(() => {
  const mockClearCart = vi.fn();
  const mockGetState = vi.fn(() => ({ clearCart: mockClearCart }));
  return { mockClearCart, mockGetState };
});

vi.mock("@/lib/cart/store", () => ({
  useCartStore: Object.assign(
    vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ items: [], clearCart: mockClearCart })
    ),
    { getState: mockGetState }
  ),
}));

vi.mock("@/app/actions/auth", () => ({
  logoutAction: vi.fn().mockResolvedValue(undefined),
}));

import { logoutAction } from "@/app/actions/auth";

describe("NavBar logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls clearCart before logoutAction", async () => {
    const { useCartStore } = await import("@/lib/cart/store");
    const clearCart = useCartStore.getState().clearCart;

    clearCart();
    await logoutAction();

    expect(mockClearCart).toHaveBeenCalledOnce();
    expect(logoutAction).toHaveBeenCalledOnce();

    const clearCartOrder = mockClearCart.mock.invocationCallOrder[0];
    const logoutOrder = (logoutAction as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(clearCartOrder).toBeLessThan(logoutOrder);
  });
});
