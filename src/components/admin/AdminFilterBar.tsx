"use client";

import { useRef } from "react";

// Single source of truth for the debounce delay on the text search input.
// Select and date inputs use immediate navigation (no debounce) because a user
// clicking a dropdown or picking a date is a deliberate single action —
// debouncing those would feel sluggish. Text input debounce prevents a
// server round-trip on every keystroke.
export const DEBOUNCE_MS = 300;

interface Props {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  // Navigation is owned by AdminOrdersShell (which holds useTransition so it
  // can dim the ledger while the new data streams in). AdminFilterBar just
  // builds the params and hands off.
  onNavigate: (params: Record<string, string>) => void;
}

export default function AdminFilterBar({
  search,
  status,
  dateFrom,
  dateTo,
  onNavigate,
}: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildParams(form: HTMLFormElement): Record<string, string> {
    const fd = new FormData(form);
    const params: Record<string, string> = {};
    for (const [key, value] of fd.entries()) {
      if (value) params[key] = value as string;
    }
    return params;
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const form = e.currentTarget.form!;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onNavigate(buildParams(form));
    }, DEBOUNCE_MS);
  }

  function handleImmediateChange(
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) {
    // Cancel any pending text-input debounce so two navigations don't race
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onNavigate(buildParams(e.currentTarget.form!));
  }

  const hasFilters = !!(search || status || dateFrom || dateTo);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      {/*
        The <form method="GET"> is a no-JS fallback only. When JS is active,
        onChange handlers call onNavigate() which uses router.push() via the
        parent AdminOrdersShell — no form submission happens.
      */}
      <form method="GET" className="flex flex-wrap items-center gap-4">
        {/* Search — debounced DEBOUNCE_MS ms */}
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Reference or client…"
          onChange={handleSearchChange}
          className="h-9 w-52 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
        />

        {/* Status — immediate navigation on change */}
        <select
          name="status"
          defaultValue={status}
          onChange={handleImmediateChange}
          className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
        </select>

        {/* Date range — immediate navigation on change */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">From</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom}
            onChange={handleImmediateChange}
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
          <label className="text-xs text-slate-400 font-medium">To</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo}
            onChange={handleImmediateChange}
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
        </div>

        {/* Apply button: only rendered when JS is unavailable so the form
            can still be submitted. With JS active the onChange handlers
            handle navigation automatically — no button needed. */}
        <noscript>
          <button
            type="submit"
            className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </noscript>

        {hasFilters && (
          <a
            href="/admin"
            className="h-9 px-4 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center"
          >
            Clear
          </a>
        )}
      </form>
    </div>
  );
}
