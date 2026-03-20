"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  FileText,
  Box,
  Bell,
} from "lucide-react";
import type { Route } from "next";

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
  isSuperAdmin: boolean;
}

const MAIN_NAV: { href: Route; label: string; icon: React.ReactNode }[] = [
  {
    href: "/admin" as Route,
    label: "Dashboard",
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
  },
  {
    href: "/admin/products" as Route,
    label: "Products",
    icon: <Package className="w-[18px] h-[18px]" />,
  },
  {
    href: "/admin/clients" as Route,
    label: "Clients",
    icon: <Users className="w-[18px] h-[18px]" />,
  },
  {
    href: "/admin/notifications" as Route,
    label: "Notifications",
    icon: <Bell className="w-[18px] h-[18px]" />,
  },
];

const SYSTEM_NAV: {
  href: Route;
  label: string;
  icon: React.ReactNode;
  superAdminOnly?: boolean;
}[] = [
  {
    href: "/admin/settings" as Route,
    label: "Settings",
    icon: <Settings className="w-[18px] h-[18px]" />,
    superAdminOnly: true,
  },
  {
    href: "/admin/audit" as Route,
    label: "Audit Log",
    icon: <FileText className="w-[18px] h-[18px]" />,
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminSidebar({ adminName, adminEmail, isSuperAdmin }: AdminSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    // Exact match for /admin, prefix match for sub-routes
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex w-[250px] min-h-screen bg-slate-900 flex-col fixed left-0 top-0 bottom-0 z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Box className="text-slate-900 w-[18px] h-[18px]" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">
            Portal
          </span>
          <span className="text-slate-500 text-xs font-medium ml-1">Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider px-3 mb-4">
          Main Menu
        </p>

        {MAIN_NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg mb-1 transition-all text-sm font-medium ${
              isActive(href)
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className={isActive(href) ? "text-slate-200" : ""}>{icon}</span>
            {label}
          </Link>
        ))}

        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider px-3 mb-4 mt-8">
          System
        </p>

        {SYSTEM_NAV.filter(
          ({ superAdminOnly }) => !superAdminOnly || isSuperAdmin
        ).map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-4 px-3 py-2.5 rounded-lg mb-1 transition-all text-sm font-medium ${
              isActive(href)
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <span className={isActive(href) ? "text-slate-200" : ""}>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 font-medium flex-shrink-0">
            {initials(adminName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium truncate">{adminName}</p>
            <p className="text-[11px] text-slate-500 truncate">{adminEmail}</p>
          </div>
          <AdminLogoutButton variant="icon" />
        </div>
      </div>
    </aside>
  );
}
