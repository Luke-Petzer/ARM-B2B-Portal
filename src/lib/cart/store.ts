"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number; // base/catalogue price — never mutated
  quantity: number;
  primaryImageUrl?: string | null;
  variantInfo?: { label: string; value: string } | null;
  // Bulk discount metadata (Feature 2) — set when item is added to cart
  discountType?: "percentage" | "fixed" | null;
  discountThreshold?: number | null;
  discountValue?: number | null;
}

/**
 * Returns the effective per-unit price after applying any bulk discount.
 * Returns `unitPrice` unchanged if no discount applies or threshold is not met.
 */
export function getEffectiveUnitPrice(item: CartItem): number {
  if (
    item.discountType &&
    item.discountValue != null &&
    isFinite(item.discountValue) &&
    item.discountThreshold != null &&
    item.discountThreshold > 0 &&
    item.quantity >= item.discountThreshold
  ) {
    if (item.discountType === "percentage") {
      return Math.max(
        0,
        parseFloat((item.unitPrice * (1 - item.discountValue / 100)).toFixed(2))
      );
    }
    if (item.discountType === "fixed") {
      return Math.max(
        0,
        parseFloat((item.unitPrice - item.discountValue).toFixed(2))
      );
    }
  }
  return item.unitPrice;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (incoming) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === incoming.productId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === incoming.productId
                  ? {
                      ...i,
                      quantity: i.quantity + (incoming.quantity ?? 1),
                      discountType: incoming.discountType,
                      discountThreshold: incoming.discountThreshold,
                      discountValue: incoming.discountValue,
                    }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...incoming, quantity: incoming.quantity ?? 1 },
            ],
          };
        });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }));
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      clearCart: () => set({ items: [] }),

      // Uses effective (post-discount) price per item
      subtotal: () =>
        get().items.reduce(
          (sum, i) => sum + getEffectiveUnitPrice(i) * i.quantity,
          0
        ),
    }),
    { name: "b2b-cart" }
  )
);
