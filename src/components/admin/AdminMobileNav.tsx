"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Package, Users, Settings, FileText, Bell, Box } from "lucide-react";
import type { Route } from "next";

interface AdminMobileNavProps {
  isSuperAdmin: boolean;
}

const MAIN_NAV: { href: Route; label: string; icon: React.ReactNode }[] = [
  { href: "/admin" as Route, label: "Dashboard", icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { href: "/admin/products" as Route, label: "Products", icon: <Package className="w-[18px] h-[18px]" /> },
  { href: "/admin/clients" as Route, label: "Clients", icon: <Users className="w-[18px] h-[18px]" /> },
  { href: "/admin/notifications" as Route, label: "Notifications", icon: <Bell className="w-[18px] h-[18px]" /> },
];

const SYSTEM_NAV: { href: Route; label: string; icon: React.ReactNode; superAdminOnly?: boolean }[] = [
  { href: "/admin/settings" as Route, label: "Settings", icon: <Settings className="w-[18px] h-[18px]" />, superAdminOnly: true },
  { href: "/admin/audit" as Route, label: "Audit Log", icon: <FileText className="w-[18px] h-[18px]" /> },
];

export default function AdminMobileNav({ isSuperAdmin }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="md:hidden relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="p-2 -ml-2 text-slate-700 hover:text-slate-900 transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 w-64 bg-slate-900 rounded-lg shadow-xl z-50 py-2 overflow-hidden">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800 mb-2">
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                <Box className="text-slate-900 w-4 h-4" />
              </div>
              <span className="text-white font-semibold text-sm">Portal Admin</span>
            </div>

            {/* Main Nav */}
            {MAIN_NAV.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <span>{icon}</span>
                {label}
              </Link>
            ))}

            {/* System Nav */}
            <div className="border-t border-slate-800 mt-2 pt-2">
              {SYSTEM_NAV.filter(({ superAdminOnly }) => !superAdminOnly || isSuperAdmin).map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-4 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive(href)
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <span>{icon}</span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
