"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Loader2, CheckCircle } from "lucide-react";
import { submitRefundRequestAction } from "@/app/actions/refund";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RefundRequestModalProps {
  orderId: string;
  referenceNumber: string;
}

const REASON_OPTIONS = [
  { value: "defective_damaged", label: "Defective or damaged goods" },
  { value: "incorrect_items", label: "Incorrect items received" },
  { value: "not_as_described", label: "Goods not as described" },
  { value: "other", label: "Other" },
] as const;

export default function RefundRequestModal({
  orderId,
  referenceNumber,
}: RefundRequestModalProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog close animation
    setTimeout(() => {
      setSubmitted(false);
      setError(null);
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      const result = await submitRefundRequestAction(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        aria-label={`Options for order ${referenceNumber}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {submitted ? (
            /* Success state */
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Request Submitted
                </h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  Your return request for <strong>{referenceNumber}</strong> has
                  been submitted. We will review it and contact you within{" "}
                  <strong>3 business days</strong> in accordance with the
                  Consumer Protection Act.
                </p>
              </div>
              <Button onClick={handleClose} className="w-full mt-2">
                Done
              </Button>
            </div>
          ) : (
            /* Form state */
            <>
              <DialogHeader>
                <DialogTitle>Request a Return</DialogTitle>
                <DialogDescription>
                  Order{" "}
                  <span className="font-medium text-slate-700">
                    {referenceNumber}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
                {/* Reason */}
                <div>
                  <label
                    htmlFor="refund-reason"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Reason for Return *
                  </label>
                  <select
                    id="refund-reason"
                    name="reason"
                    required
                    defaultValue=""
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  >
                    <option value="" disabled>
                      Select a reason…
                    </option>
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date received */}
                <div>
                  <label
                    htmlFor="refund-date"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Date Goods Were Received *
                  </label>
                  <input
                    id="refund-date"
                    name="dateReceived"
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  />
                </div>

                {/* Additional details */}
                <div>
                  <label
                    htmlFor="refund-details"
                    className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
                  >
                    Additional Details{" "}
                    <span className="normal-case font-normal text-slate-400">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="refund-details"
                    name="details"
                    rows={3}
                    maxLength={1000}
                    placeholder="Describe the issue in more detail…"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all resize-none"
                  />
                </div>

                {/* Disclaimer */}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Submitting this form initiates a review process. Under the
                  Consumer Protection Act, returns of defective goods are
                  assessed on a case-by-case basis. You will be contacted once
                  your request is reviewed.
                </p>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Return Request"
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
