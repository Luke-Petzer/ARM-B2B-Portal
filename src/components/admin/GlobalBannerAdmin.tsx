"use client";

import { useState, useTransition } from "react";
import { Loader2, Bell, BellOff } from "lucide-react";
import { saveGlobalBannerAction } from "@/app/actions/admin";

interface GlobalBannerAdminProps {
  initialMessage: string | null;
  initialActive: boolean;
}

export default function GlobalBannerAdmin({
  initialMessage,
  initialActive,
}: GlobalBannerAdminProps) {
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("idle");
    setErrorMsg(null);
    const fd = new FormData();
    fd.set("banner_message", message);
    fd.set("is_banner_active", isActive ? "true" : "false");
    startTransition(async () => {
      const result = await saveGlobalBannerAction(fd);
      if ("error" in result) {
        setErrorMsg(result.error);
        setStatus("error");
      } else {
        setStatus("success");
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
          {isActive ? (
            <Bell className="w-5 h-5 text-amber-600" />
          ) : (
            <BellOff className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Notification Banner
          </h2>
          <p className="text-sm text-slate-500">
            Displays a message at the top of the portal for all signed-in buyers.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-900">Banner Active</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isActive
                ? "Banner is currently visible to buyers."
                : "Banner is hidden from buyers."}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>

        {/* Message textarea */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Banner Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="e.g. Our warehouse will be closed 24–26 December. Orders placed now will ship from 2 January."
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all resize-none"
          />
          <p className="text-[11px] text-slate-400">Plain text only.</p>
        </div>

        {/* Live preview */}
        {message && isActive && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 mr-2">
              Preview:
            </span>
            {message}
          </div>
        )}

        {/* Status feedback */}
        {status === "success" && (
          <p className="text-sm text-emerald-700 font-medium">
            Banner settings saved successfully.
          </p>
        )}
        {status === "error" && errorMsg && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-11 px-6 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Banner Settings"
          )}
        </button>
      </form>
    </div>
  );
}
