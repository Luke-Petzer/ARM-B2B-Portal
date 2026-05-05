"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  markRefundAcknowledgedAction,
  markRefundResolvedAction,
} from "@/app/actions/refund-admin";

interface RefundRequestActionsProps {
  refundRequestId: string;
  status: "pending" | "acknowledged" | "resolved";
}

export default function RefundRequestActions({
  refundRequestId,
  status,
}: RefundRequestActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "resolved") {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const handleAcknowledge = () => {
    setError(null);
    startTransition(async () => {
      const result = await markRefundAcknowledgedAction(refundRequestId);
      if ("error" in result) setError(result.error);
    });
  };

  const handleResolve = () => {
    setError(null);
    startTransition(async () => {
      const result = await markRefundResolvedAction(refundRequestId);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {status === "pending" && (
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={isPending}
            className="h-7 px-2.5 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin inline" />
            ) : (
              "Acknowledge"
            )}
          </button>
        )}
        <button
          type="button"
          onClick={handleResolve}
          disabled={isPending}
          className="h-7 px-2.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin inline" />
          ) : (
            "Resolve"
          )}
        </button>
      </div>
      {error && (
        <span className="text-[10px] text-red-600">{error}</span>
      )}
    </div>
  );
}
