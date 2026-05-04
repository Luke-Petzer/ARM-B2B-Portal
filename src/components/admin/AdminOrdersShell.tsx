"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import AdminFilterBar from "./AdminFilterBar";

interface FilterProps {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  filterProps: FilterProps;
  // OrderLedger (and any other server-rendered children) is passed in so
  // AdminOrdersShell can wrap it in the opacity div without needing to own
  // the server-fetched data itself.
  children: React.ReactNode;
}

export default function AdminOrdersShell({ filterProps, children }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(params: Record<string, string>) {
    // Reset to page 1 on every filter change — the current page number may
    // be out of range for the newly filtered result set.
    const qs = new URLSearchParams(params).toString();
    startTransition(() => {
      // Cast required: Next.js typed-routes validates RouteImpl at build time.
      // The constructed URL is always a valid /admin sub-route; the cast is safe.
      router.push(`/admin${qs ? `?${qs}` : ""}` as Route, { scroll: false });
    });
  }

  return (
    <>
      <AdminFilterBar {...filterProps} onNavigate={navigate} />

      {/*
        useTransition keeps the old OrderLedger content mounted while the
        server re-renders with the new filtered data. isPending drives a
        subtle opacity dim so the admin knows a fetch is in flight without
        an intrusive spinner.
      */}
      <div
        className="transition-opacity duration-150"
        style={{ opacity: isPending ? 0.7 : 1 }}
      >
        {children}
      </div>
    </>
  );
}
