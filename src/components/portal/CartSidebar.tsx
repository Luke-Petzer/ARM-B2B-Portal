"use client";

import Link from "next/link";
import { ShoppingCart, X, Package } from "lucide-react";
import { useCartStore, getEffectiveUnitPrice } from "@/lib/cart/store";
import type { Route } from "next";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

export default function CartSidebar() {
  const { items, removeItem, subtotal } = useCartStore();
  const sub = subtotal();

  return (
    <aside className="hidden lg:flex w-[400px] border-l border-gray-100 bg-white flex-col flex-shrink-0 z-40">
      {/* Header */}
      <div className="p-6 flex-shrink-0 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-[18px] h-[18px]" />
          Current Cart
          {items.length > 0 && (
            <span className="ml-auto text-xs font-medium text-gray-400">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          )}
        </h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Your cart is empty.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="flex gap-4">
              {/* Thumbnail */}
              <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                {item.primaryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.primaryImageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <Package className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <h3 className="text-[13px] font-semibold text-slate-900 truncate">
                    {item.sku}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                    aria-label={`Remove ${item.sku} from cart`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[12px] text-gray-400 mb-1 truncate">{item.name}</p>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-gray-500">
                    Qty: {item.quantity}
                  </span>
                  <div className="text-right">
                    <span className="text-[13px] font-medium text-slate-900">
                      {ZAR.format(getEffectiveUnitPrice(item) * item.quantity)}
                    </span>
                    {getEffectiveUnitPrice(item) < item.unitPrice && (
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Save{" "}
                        {ZAR.format(
                          (item.unitPrice - getEffectiveUnitPrice(item)) *
                            item.quantity
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-slate-900 font-medium">{ZAR.format(sub)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="text-base font-semibold text-slate-900">Total</span>
            <span className="text-base font-bold text-slate-900">
              {ZAR.format(sub)}
            </span>
          </div>
        </div>
        <Link
          href={"/cart" as Route}
          className={[
            "w-full flex items-center justify-center h-12 rounded font-semibold text-sm transition-all",
            items.length === 0
              ? "bg-gray-100 text-gray-400 pointer-events-none"
              : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98]",
          ].join(" ")}
          aria-disabled={items.length === 0}
          tabIndex={items.length === 0 ? -1 : 0}
        >
          Review Order
        </Link>
      </div>
    </aside>
  );
}
