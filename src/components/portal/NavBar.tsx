"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Loader2, ShoppingCart } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { useCartStore } from "@/lib/cart/store";
import type { Route } from "next";
import type { AppRole } from "@/lib/supabase/types";

const BASE_NAV_LINKS: { href: Route; label: string }[] = [
  { href: "/dashboard", label: "Catalogue" },
  { href: "/orders", label: "Order History" },
];

interface NavBarProps {
  role?: AppRole;
}

export default function NavBar({ role }: NavBarProps) {
  const NAV_LINKS = [
    ...BASE_NAV_LINKS,
    ...(role === "buyer_30_day"
      ? [{ href: "/dashboard/statement" as Route, label: "Statement" }]
      : []),
  ];
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();

  // Live cart count for mobile badge — sum of all item quantities
  const cartCount = useCartStore((s) =>
    s.items.reduce((n, item) => n + item.quantity, 0)
  );

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      {/* Full-screen overlay while logout is in flight */}
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

      <nav className="h-[64px] border-b border-gray-100 bg-white flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50">
        {/* Left — brand + nav links */}
        <div className="flex items-center gap-8">
          <Link href={"/dashboard" as Route} className="flex items-center">
            <Image
              src="/logo.png"
              alt="AR Steel Manufacturing"
              height={36}
              width={150}
              priority
              className="object-contain"
            />
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-8 ml-4">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "text-sm font-medium transition-colors border-b-2 pb-0.5",
                    isActive
                      ? "text-primary border-primary"
                      : "text-gray-700 border-transparent hover:text-primary hover:border-primary",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right — cart icon (mobile/tablet) + logout (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-4">
          {/* Cart icon — visible below lg where CartSidebar is hidden */}
          <Link
            href={"/cart" as Route}
            className="lg:hidden relative p-2 -mr-1 text-slate-700 hover:text-slate-900 transition-colors"
            aria-label={`Cart (${cartCount} items)`}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-slate-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* Desktop logout — hidden on mobile */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : null}
            Logout
          </button>

          {/* Mobile hamburger toggle — hidden on desktop */}
          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-slate-900"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 shadow-sm z-40">
          <div className="flex flex-col px-8 py-4 gap-4">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={[
                    "text-sm font-medium py-2 transition-colors border-b-2",
                    isActive
                      ? "text-primary border-primary"
                      : "text-gray-700 border-transparent hover:text-primary hover:border-primary",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors w-full disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
