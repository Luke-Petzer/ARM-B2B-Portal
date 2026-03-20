"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { markPaymentSubmittedAction } from "@/app/actions/checkout";

interface PaymentFormProps {
  orderId: string;
  bankRef: string;
}

export default function PaymentForm({ orderId, bankRef }: PaymentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("orderId", orderId);
      const result = await markPaymentSubmittedAction(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-4 bg-red-50 border border-red-100 rounded text-[13px] text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded font-semibold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </>
        ) : (
          "I have made the payment"
        )}
      </button>
    </div>
  );
}
