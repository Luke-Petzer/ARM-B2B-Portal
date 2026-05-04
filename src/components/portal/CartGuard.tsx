"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

const SESSION_FLAG = "cart-session-active";

/**
 * Exported for unit testing — runs the same logic as the useEffect.
 * In production, only the default export (React component) is used.
 */
export function renderCartGuardEffect(): void {
  if (sessionStorage.getItem(SESSION_FLAG)) return;
  useCartStore.getState().clearCart();
  sessionStorage.setItem(SESSION_FLAG, "1");
}

/**
 * Clears any leftover cart data from a previous user session.
 *
 * Mounted in the portal layout. On fresh page loads (login redirect, browser
 * refresh, new tab), the sessionStorage flag is absent, so the cart is cleared.
 * During normal in-app navigation the layout stays mounted and this effect
 * does not re-run.
 */
export default function CartGuard() {
  useEffect(() => {
    renderCartGuardEffect();
  }, []);
  return null;
}
