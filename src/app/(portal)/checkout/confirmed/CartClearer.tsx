"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

/**
 * Clears the Zustand cart when the confirmation page mounts.
 * This runs once — after a successful order the cart should be empty.
 */
export default function CartClearer() {
  const clearCart = useCartStore((s) => s.clearCart);
  useEffect(() => {
    clearCart();
  }, [clearCart]);
  return null;
}
