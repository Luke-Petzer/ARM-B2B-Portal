"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Info, Loader2, Trash2 } from "lucide-react";
import { useCartStore, getEffectiveUnitPrice } from "@/lib/cart/store";
import QuantityStepper from "@/components/portal/QuantityStepper";
import { checkoutAction } from "@/app/actions/checkout";
import DeliveryAddressPicker, { type ShippingAddress } from "@/components/portal/DeliveryAddressPicker";
import { useRouter } from "next/navigation";

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

const VAT_RATE = 0.15;

interface ReorderItem {
  productId: string | null;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface CartReviewShellProps {
  reorderItems: ReorderItem[] | null;
  shippingAddresses: ShippingAddress[];
}

export default function CartReviewShell({ reorderItems, shippingAddresses }: CartReviewShellProps) {
  const { items, updateQuantity, removeItem, subtotal, addItem, clearCart } = useCartStore();
  const [error, setError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const defaultAddr = shippingAddresses.find((a) => a.is_default) ?? shippingAddresses[0] ?? null;
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddr?.id ?? null);

  // Replace cart with reorder items on mount (clear first to prevent quantity accumulation)
  useEffect(() => {
    if (!reorderItems) return;
    clearCart();
    reorderItems.forEach((item) => {
      if (item.productId) {
        addItem({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sub = subtotal();
  const vat = parseFloat((sub * VAT_RATE).toFixed(2));
  const total = parseFloat((sub + vat).toFixed(2));

  const handleCheckout = () => {
    setError(null);
    startTransition(async () => {
      const result = await checkoutAction(items, orderNotes, undefined, selectedAddressId);
      if (result?.error) setError(result.error);
      // On success: checkoutAction calls redirect() — component unmounts
    });
  };

  return (
    <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-8 mt-12 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Review Order</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify your items and quantities before proceeding to checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Items table — 8 cols on desktop, full width on mobile */}
        <div className="col-span-1 lg:col-span-8 bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
          {items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">Your cart is empty.</p>
              <Link
                href="/dashboard"
                className="inline-block mt-4 text-sm font-medium text-slate-900 hover:underline"
              >
                ← Back to Catalogue
              </Link>
            </div>
          ) : (
            <div>
              {/* Desktop header row — hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-[1fr_2fr_1fr_1fr_1fr_48px] gap-x-6 bg-slate-50 border-b border-gray-100 px-6 py-4">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Product SKU</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Description</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Unit Price</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quantity</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Line Total</span>
                <span />
              </div>

              {/* Items */}
              {items.map((item) => {
                const effectivePrice = getEffectiveUnitPrice(item);
                const lineTotal = parseFloat((effectivePrice * item.quantity).toFixed(2));
                const hasBulkDiscount = effectivePrice < item.unitPrice;
                // Single stepper declaration per item — only one layout is visible at any breakpoint via md:hidden/hidden md:grid
                const stepper = (
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(q) => updateQuantity(item.productId, q)}
                  />
                );

                return (
                  <div key={item.productId} className="border-b border-gray-100 last:border-b-0">
                    {/* Mobile card — block on mobile, hidden on md+ */}
                    <div className="md:hidden p-4 flex flex-col gap-4">
                      {/* Name + SKU */}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sku}</p>
                      </div>
                      {/* Unit price */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Unit Price</span>
                        <span className="text-sm text-slate-700">{ZAR.format(effectivePrice)}</span>
                      </div>
                      {/* Quantity */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantity</span>
                        {stepper}
                      </div>
                      {/* Line total */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Line Total</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-slate-900">{ZAR.format(lineTotal)}</span>
                          {hasBulkDiscount && (
                            <p className="text-xs text-emerald-600 font-medium">Bulk discount applied</p>
                          )}
                        </div>
                      </div>
                      {/* Remove */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Desktop row — hidden on mobile, grid on md+ */}
                    <div className="hidden md:grid md:grid-cols-[1fr_2fr_1fr_1fr_1fr_48px] gap-x-6 items-center px-6 py-5">
                      <span className="text-sm font-medium text-slate-900">{item.sku}</span>
                      <span className="text-sm text-gray-500">{item.name}</span>
                      <span className="text-sm text-slate-700">{ZAR.format(effectivePrice)}</span>
                      <div>
                        {stepper}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-900">{ZAR.format(lineTotal)}</span>
                        {hasBulkDiscount && (
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">Bulk discount applied</p>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order summary — 4 cols */}
        <div className="col-span-1 lg:col-span-4">
          <DeliveryAddressPicker
            addresses={shippingAddresses}
            selectedId={selectedAddressId}
            onSelect={setSelectedAddressId}
            onAddressAdded={() => router.refresh()}
          />
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-6 sticky top-24">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">
              Order Summary
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Subtotal (Excl. VAT)</span>
                <span className="text-sm font-medium text-slate-900">
                  {ZAR.format(sub)}
                </span>
              </div>
              {items.some((i) => getEffectiveUnitPrice(i) < i.unitPrice) && (
                <div className="flex justify-between items-center text-emerald-700">
                  <span className="text-sm">Bulk Discount Savings</span>
                  <span className="text-sm font-medium">
                    -
                    {ZAR.format(
                      items.reduce(
                        (acc, i) =>
                          acc +
                          (i.unitPrice - getEffectiveUnitPrice(i)) * i.quantity,
                        0
                      )
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">VAT (15%)</span>
                <span className="text-sm font-medium text-slate-900">
                  {ZAR.format(vat)}
                </span>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-900">
                  Final Total
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {ZAR.format(total)}
                </span>
              </div>
            </div>

            {/* Order Notes */}
            <div className="mb-6">
              <label
                htmlFor="order_notes"
                className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5"
              >
                Order Notes & Special Requests (optional)
              </label>
              <textarea
                id="order_notes"
                name="order_notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Delivery preferences, pricing discussions, or custom material requests..."
                maxLength={1000}
                className="w-full min-h-[80px] resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 px-4 py-4 bg-red-50 border border-red-100 rounded text-[13px] text-red-700">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={items.length === 0 || isPending}
              className="flex items-center justify-center gap-2 w-full h-12 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing…
                </>
              ) : (
                "Proceed to Checkout"
              )}
            </button>

            <div className="mt-6 flex items-start gap-4 p-4 bg-white/50 border border-slate-200 rounded text-[12px] text-gray-500">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
              <p>
                VAT is calculated at 15% and confirmed at checkout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
