"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface AdminLogoutButtonProps {
  /** "icon" = small icon-only button for the sidebar footer.
   *  "header" = full text+icon button for the top header bar. */
  variant: "icon" | "header";
}

export default function AdminLogoutButton({ variant }: AdminLogoutButtonProps) {
  const [isLoggingOut, startLogout] = useTransition();

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      {/* Full-screen frosted overlay — covers sidebar + header */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
            <p className="text-sm font-medium text-slate-600">
              Logging out safely...
            </p>
          </div>
        </div>
      )}

      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none"
          title="Sign out"
          aria-label="Sign out"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 h-9 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Logout
        </button>
      )}
    </>
  );
}
