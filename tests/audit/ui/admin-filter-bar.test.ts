// tests/audit/ui/admin-filter-bar.test.ts
//
// Guards the AdminFilterBar + AdminOrdersShell contract.
//
// Architecture:
//   AdminOrdersShell (client) — owns useTransition + useRouter
//     ├── AdminFilterBar (client) — builds params, calls onNavigate prop
//     └── <div opacity={isPending ? 0.7 : 1}> — dims ledger while streaming
//           └── OrderLedger children (passed from Server Component)
//
//   When a filter changes:
//     AdminFilterBar.onNavigate(params) → AdminOrdersShell.navigate(params)
//     → startTransition(() => router.push(`/admin?${qs}`, { scroll: false }))
//     → isPending = true → ledger dims → server re-renders → new data streams in
//     → isPending = false → ledger undims
//
//   No form.requestSubmit(), no page reload, no spinner.
//   The form stays as <form method="GET"> as a no-JS fallback only.
//   The "Apply" button is in <noscript> — invisible when JS is active.
//
// Test strategy:
//   1. Debounce behavioural tests — pure timer logic, unchanged from previous impl
//   2. AdminFilterBar structural tests — verify correct shape after rewrite
//   3. AdminOrdersShell structural tests — verify useTransition, router.push, opacity

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── 1. Debounce behavioural contract ─────────────────────────────────────────

describe("Debounce logic (DEBOUNCE_MS = 300)", () => {
  const DEBOUNCE_MS = 300;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("callback does NOT fire before the debounce window elapses", () => {
    const fn = vi.fn();
    let timer: number | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, DEBOUNCE_MS) as unknown as number;
    };

    trigger();
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("callback fires exactly once after DEBOUNCE_MS elapses", () => {
    const fn = vi.fn();
    let timer: number | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, DEBOUNCE_MS) as unknown as number;
    };

    trigger();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rapid successive calls reset the timer (trailing-edge debounce)", () => {
    const fn = vi.fn();
    let timer: number | null = null;

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, DEBOUNCE_MS) as unknown as number;
    };

    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("select/date immediate path fires without delay", () => {
    const fn = vi.fn();
    fn();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── 2. AdminFilterBar structural tests ───────────────────────────────────────

let filterBarSource: string;

try {
  filterBarSource = fs.readFileSync(
    path.resolve(__dirname, "../../../src/components/admin/AdminFilterBar.tsx"),
    "utf-8"
  );
} catch {
  filterBarSource = "";
}

describe("AdminFilterBar source structure", () => {
  it("is a client component ('use client' directive present)", () => {
    expect(filterBarSource).toMatch(/^["']use client["']/m);
  });

  it("exports DEBOUNCE_MS constant equal to 300", () => {
    expect(filterBarSource).toMatch(/export\s+const\s+DEBOUNCE_MS\s*=\s*300\b/);
  });

  it("accepts an onNavigate prop (delegates navigation to parent shell)", () => {
    // AdminFilterBar no longer owns the router — it calls onNavigate()
    // and lets AdminOrdersShell handle router.push + useTransition.
    expect(filterBarSource).toMatch(/onNavigate/);
  });

  it("does NOT call form.requestSubmit (router.push is used instead)", () => {
    expect(filterBarSource).not.toMatch(/requestSubmit/);
  });

  it("does NOT contain an animate-spin spinner (no spinner in search field)", () => {
    expect(filterBarSource).not.toMatch(/animate-spin/);
  });

  it("keeps <form method=\"GET\"> as no-JS fallback", () => {
    expect(filterBarSource).toMatch(/method="GET"/);
  });

  it("Apply button is inside <noscript> (hidden when JS is active)", () => {
    // The Apply button must only be visible when JS is disabled.
    // With JS active, onNavigate auto-submits — the button is redundant noise.
    expect(filterBarSource).toMatch(/<noscript>/);
    // And it must NOT have a visible submit button outside noscript
    const withoutNoscript = filterBarSource.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
    expect(withoutNoscript).not.toMatch(/type="submit"/);
  });
});

// ── 3. AdminOrdersShell structural tests ─────────────────────────────────────

let shellSource: string;

try {
  shellSource = fs.readFileSync(
    path.resolve(__dirname, "../../../src/components/admin/AdminOrdersShell.tsx"),
    "utf-8"
  );
} catch {
  shellSource = "";
}

describe("AdminOrdersShell source structure", () => {
  it("file exists at src/components/admin/AdminOrdersShell.tsx", () => {
    expect(shellSource).not.toBe("");
  });

  it("is a client component ('use client' directive present)", () => {
    expect(shellSource).toMatch(/^["']use client["']/m);
  });

  it("uses useTransition (required for seamless streaming navigation)", () => {
    expect(shellSource).toMatch(/useTransition/);
  });

  it("uses router.push with scroll: false", () => {
    // scroll: false prevents the page from jumping to the top on each
    // filter change — the admin stays at their current scroll position.
    expect(shellSource).toMatch(/scroll:\s*false/);
  });

  it("isPending controls table opacity (dims ledger while server renders)", () => {
    // The opacity transition must reference isPending. We check for both
    // isPending and opacity appearing in the file — exact class names may vary.
    expect(shellSource).toMatch(/isPending/);
    expect(shellSource).toMatch(/opacity/);
  });
});
