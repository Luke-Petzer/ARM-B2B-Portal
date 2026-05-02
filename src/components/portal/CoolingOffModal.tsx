"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CoolingOffModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="View cooling-off and returns notice"
      >
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Returns &amp; cancellations notice</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Returns &amp; Cancellations Notice</DialogTitle>
            <DialogDescription>
              Your rights under Section 44 of the Electronic Communications and
              Transactions Act, 2002.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 text-[13px] text-slate-600 leading-relaxed space-y-3">
            <p>
              Consumer customers have the right to cancel this order within{" "}
              <strong className="text-slate-800">five (5) business days</strong> of
              receiving the goods, in terms of Section 44 of the Electronic
              Communications and Transactions Act, 2002.
            </p>
            <p>
              This right does not apply to custom-manufactured goods, goods cut or
              altered to your specifications, or to business-to-business purchases.
            </p>
            <p>
              For full details, see our{" "}
              <Link
                href="/terms#returns"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-slate-900"
              >
                Returns, Refunds &amp; Cancellations Policy
              </Link>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
