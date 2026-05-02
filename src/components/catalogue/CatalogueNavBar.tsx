"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/portal/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import type { AppRole } from "@/lib/supabase/types";

interface NavState {
  isAuthenticated: boolean;
  role: AppRole | null;
  businessName: string | null;
}

export default function CatalogueNavBar() {
  const [navState, setNavState] = useState<NavState | null>(null);

  useEffect(() => {
    fetch("/api/auth/nav-state")
      .then((res) => res.json())
      .then((data: NavState) => setNavState(data))
      .catch(() => {
        // On failure, default to public NavBar — safe fallback
        setNavState({ isAuthenticated: false, role: null, businessName: null });
      });
  }, []);

  // Placeholder while API call resolves — same height as both NavBars
  if (navState === null) {
    return <div className="h-[72px] flex-shrink-0" aria-hidden="true" />;
  }

  if (navState.isAuthenticated) {
    return (
      <NavBar
        role={navState.role ?? undefined}
        businessName={navState.businessName}
      />
    );
  }

  // PublicNavBar is fixed — add spacer div so content sits below it
  return (
    <>
      <PublicNavBar activeItem="catalogue" />
      <div className="h-[72px] flex-shrink-0" aria-hidden="true" />
    </>
  );
}
