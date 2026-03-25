"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { markPaymentSubmittedAction } from "@/app/actions/checkout";

interface PaymentFormProps {
  orderId: string;
  bankRef: string;
}

export default function PaymentForm({ orderId }: PaymentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [buyerReference, setBuyerReference] = useState("");

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("orderId", orderId);
      if (buyerReference.trim()) {
        formData.set("buyer_reference", buyerReference.trim());
      }
      const result = await markPaymentSubmittedAction(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      {/* Optional PO Number */}
      <div>
        <label
          htmlFor="buyer_reference"
          className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5"
        >
          Purchase Order (PO) Number{" "}
          <span className="font-normal normal-case tracking-normal text-gray-300">
            — optional
          </span>
        </label>
        <input
          id="buyer_reference"
          type="text"
          value={buyerReference}
          onChange={(e) => setBuyerReference(e.target.value)}
          placeholder="e.g. PO-2026-0042"
          maxLength={100}
          className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Your internal PO reference will appear on the Proforma Invoice.
        </p>
      </div>

      {error && (
        <div className="px-4 py-4 bg-red-50 border border-red-100 rounded text-[13px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full h-12 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting…
          </>
        ) : (
          "Submit Order & Generate Proforma"
        )}
      </button>
    </div>
  );
}
