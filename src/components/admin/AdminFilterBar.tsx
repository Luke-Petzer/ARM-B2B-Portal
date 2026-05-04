"use client";

import { useRef, useState } from "react";

// Single source of truth for the debounce delay on the text search input.
// Select and date inputs use immediate submit (no debounce) because a user
// clicking a dropdown or picking a date is a deliberate single action —
// debouncing those would feel sluggish. Text input debounce prevents a
// server round-trip on every keystroke.
export const DEBOUNCE_MS = 300;

interface Props {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export default function AdminFilterBar({ search, status, dateFrom, dateTo }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, setIsPending] = useState(false);

  function submitForm(form: HTMLFormElement) {
    setIsPending(true);
    form.requestSubmit();
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const form = e.currentTarget.form!;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      submitForm(form);
    }, DEBOUNCE_MS);
  }

  function handleImmediateChange(
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) {
    // Cancel any pending text-input debounce so two navigations don't race
    if (debounceRef.current) clearTimeout(debounceRef.current);
    submitForm(e.currentTarget.form!);
  }

  const hasFilters = !!(search || status || dateFrom || dateTo);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
      <form
        method="GET"
        aria-busy={isPending}
        // Reset spinner once the page re-renders from the server (component
        // remounts with new defaultValues after navigation completes).
        onSubmit={() => setIsPending(true)}
        className="flex flex-wrap items-center gap-4"
      >
        {/* Search — debounced DEBOUNCE_MS ms */}
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Reference or client…"
            onChange={handleSearchChange}
            className="h-9 w-52 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          />
          {isPending && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"
            />
          )}
        </div>

        {/* Status — immediate submit on change */}
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

        {/* Date range — immediate submit on change */}
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

        {/* Apply button — kept as keyboard / no-JS fallback. Debounce and
            immediate-change handlers call requestSubmit() automatically, so
            most users will never need to click this. It costs nothing to keep
            it and removing it would break keyboard-only and no-JS flows. */}
        <button
          type="submit"
          className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Apply
        </button>

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
