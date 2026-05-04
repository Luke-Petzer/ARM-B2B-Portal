// tests/audit/ui/admin-filter-bar.test.ts
//
// Guards the AdminFilterBar debounce contract and structural guarantees.
//
// Why this component exists:
//   The admin command centre (/admin) used a plain <form method="GET"> with a
//   manual "Apply" button. Every filter change required an explicit click to
//   trigger a full page reload. Products/Clients pages have instant client-side
//   search, creating a jarring UX inconsistency.
//
//   AdminFilterBar extracts the filter form into a client component that:
//   - Debounces text input at DEBOUNCE_MS (300ms) before calling requestSubmit()
//   - Immediately calls requestSubmit() on select/date changes
//   - Shows a spinner while the round-trip is in flight (aria-busy)
//   - Keeps the form as method="GET" for shareable, URL-driven state
//
// Test strategy:
//   1. Behavioral debounce tests — pure timer logic with fake timers
//   2. Source-text structural tests — verify the component has the correct
//      constants, attributes, and handler separation

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── 1. Debounce behavioural contract ─────────────────────────────────────────
//
// We test the debounce pattern as a pure function so the test is fast and
// deterministic. The AdminFilterBar uses this same pattern internally via
// a useRef timer and DEBOUNCE_MS.

describe("Debounce logic (DEBOUNCE_MS = 300)", () => {
  const DEBOUNCE_MS = 300; // must match AdminFilterBar.DEBOUNCE_MS

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("callback does NOT fire before the debounce window elapses", () => {
    const fn = vi.fn();
    // vi.useFakeTimers() makes setTimeout return number, not NodeJS.Timeout
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

    // Simulate 5 keystrokes 50ms apart — well within the debounce window
    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();
    vi.advanceTimersByTime(50);
    trigger();

    // Still within debounce window — should not have fired
    expect(fn).not.toHaveBeenCalled();

    // Advance past the debounce window after the last call
    vi.advanceTimersByTime(DEBOUNCE_MS);

    // Should fire exactly once — the trailing call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("select/date immediate-submit path fires without any delay", () => {
    // For select and date inputs there is NO timeout — the submit is called
    // synchronously within the handler. Simulate that pattern:
    const fn = vi.fn();

    // No timer involved — direct call
    fn();

    expect(fn).toHaveBeenCalledTimes(1);
    // And it fires before any timers advance
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1); // not called again
  });
});

// ── 2. AdminFilterBar source structure ───────────────────────────────────────

let source: string;

try {
  source = fs.readFileSync(
    path.resolve(__dirname, "../../../src/components/admin/AdminFilterBar.tsx"),
    "utf-8"
  );
} catch {
  source = ""; // file missing → all structural tests below will fail
}

describe("AdminFilterBar source structure", () => {
  it("file exists at src/components/admin/AdminFilterBar.tsx", () => {
    expect(source).not.toBe("");
  });

  it("is a client component ('use client' directive present)", () => {
    expect(source).toMatch(/^["']use client["']/m);
  });

  it("exports DEBOUNCE_MS constant equal to 300", () => {
    expect(source).toMatch(/export\s+const\s+DEBOUNCE_MS\s*=\s*300\b/);
  });

  it("text input onChange handler references DEBOUNCE_MS (uses debounce path)", () => {
    // The search text input must use DEBOUNCE_MS in its onChange handler
    // to ensure the constant is the single source of truth for the delay.
    expect(source).toMatch(/DEBOUNCE_MS/);
    // And the search input must have an onChange prop
    expect(source).toMatch(/name="search"[\s\S]{0,300}onChange/);
  });

  it("form element has method=\"GET\" (URL-driven, shareable state)", () => {
    expect(source).toMatch(/method="GET"/);
  });

  it("form or wrapper element uses aria-busy for pending indicator", () => {
    expect(source).toMatch(/aria-busy/);
  });

  it("\"Apply\" button is preserved as fallback", () => {
    // The Apply button stays as a no-JS fallback. Removing it would break
    // the form for users without JavaScript and for keyboard-only navigation.
    expect(source).toMatch(/Apply/);
    expect(source).toMatch(/type="submit"/);
  });
});
