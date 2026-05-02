"use client";

import Link from "next/link";
import { useConsentStore } from "@/lib/consent/store";

export default function CookieBanner() {
  const status = useConsentStore((s) => s.status);
  const acceptAll = useConsentStore((s) => s.acceptAll);
  const rejectAll = useConsentStore((s) => s.rejectAll);
  const openModal = useConsentStore((s) => s.openModal);

  if (status !== "pending") return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#050d14] border-t border-white/10 px-4 py-4 md:py-5"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-white/70 leading-relaxed">
          We use cookies to keep you logged in and remember your preferences.{" "}
          <Link
            href="/cookie-policy"
            className="text-white underline hover:text-white/80 transition-colors"
          >
            Cookie Policy
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={rejectAll}
            className="text-xs font-semibold px-4 py-2 border border-white/20 rounded text-white/70 hover:bg-white/5 transition-colors"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-semibold px-4 py-2 border border-white/20 rounded text-white/70 hover:bg-white/5 transition-colors"
          >
            Customise
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="text-xs font-semibold px-4 py-2 bg-white text-[#050d14] rounded hover:bg-white/90 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
