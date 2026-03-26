"use client";

import { Loader2 } from "lucide-react";
import { useLogoutStore } from "@/lib/ui/logout-store";

/**
 * Full-screen logout overlay. Rendered as a direct child of <body> in the root
 * layout so it is completely outside any overflow-hidden / backdrop-filter
 * containing block in the layout tree.
 */
export default function LogoutOverlay() {
  const isLoggingOut = useLogoutStore((s) => s.isLoggingOut);

  if (!isLoggingOut) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Logging out safely...</p>
      </div>
    </div>
  );
}
