# POPIA Cookie Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a POPIA-compliant cookie consent system with a non-blocking banner, per-category preferences modal, cookie policy page, and footer links.

**Architecture:** Zustand v5 persist store holds consent status and per-category preferences in `localStorage` (`cookie-consent-v1`). A fixed-bottom banner appears on first visit when status is `"pending"` and disappears after any choice. A preferences modal is accessible from both the banner's "Customise" button and a "Cookie Settings" footer link.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand v5 with `persist` middleware, Tailwind CSS, TypeScript, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/consent/store.ts` | Create | Zustand consent store — status, preferences, modal state, actions |
| `src/components/consent/CookieBanner.tsx` | Create | Fixed-bottom banner shown when status is `"pending"` |
| `src/components/consent/PreferencesModal.tsx` | Create | Per-category toggles modal |
| `src/app/cookie-policy/page.tsx` | Create | Public static cookie policy page |
| `tests/audit/consent/consent-store.test.ts` | Create | Unit tests for all store state transitions |
| `src/app/layout.tsx` | Modify | Mount `<CookieBanner />` and `<PreferencesModal />` |
| `src/app/page.tsx` | Modify | Add Cookie Policy link + Cookie Settings button to footer |
| `src/app/terms/page.tsx` | Modify | Update Section 9 privacy copy to reference cookie policy |

---

### Task 1: Consent Store

**Files:**
- Create: `src/lib/consent/store.ts`
- Create: `tests/audit/consent/consent-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/audit/consent/consent-store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub persist so tests never touch localStorage
vi.mock("zustand/middleware", () => ({
  persist: (fn: Parameters<typeof fn>[0], _options: unknown) => fn,
}));

import { useConsentStore } from "@/lib/consent/store";

const reset = () =>
  useConsentStore.setState({
    status: "pending",
    preferences: { necessary: true, analytics: false, marketing: false },
    modalOpen: false,
  });

describe("useConsentStore", () => {
  beforeEach(reset);

  it("starts in pending status", () => {
    expect(useConsentStore.getState().status).toBe("pending");
  });

  it("acceptAll sets status accepted and all preferences true", () => {
    useConsentStore.getState().acceptAll();
    const { status, preferences } = useConsentStore.getState();
    expect(status).toBe("accepted");
    expect(preferences.analytics).toBe(true);
    expect(preferences.marketing).toBe(true);
    expect(preferences.necessary).toBe(true);
  });

  it("rejectAll sets status rejected and non-necessary to false", () => {
    useConsentStore.getState().acceptAll();
    useConsentStore.getState().rejectAll();
    const { status, preferences } = useConsentStore.getState();
    expect(status).toBe("rejected");
    expect(preferences.analytics).toBe(false);
    expect(preferences.marketing).toBe(false);
    expect(preferences.necessary).toBe(true);
  });

  it("openModal sets modalOpen true", () => {
    useConsentStore.getState().openModal();
    expect(useConsentStore.getState().modalOpen).toBe(true);
  });

  it("closeModal sets modalOpen false", () => {
    useConsentStore.getState().openModal();
    useConsentStore.getState().closeModal();
    expect(useConsentStore.getState().modalOpen).toBe(false);
  });

  it("updatePreference toggles individual category", () => {
    useConsentStore.getState().updatePreference("analytics", true);
    expect(useConsentStore.getState().preferences.analytics).toBe(true);
    useConsentStore.getState().updatePreference("analytics", false);
    expect(useConsentStore.getState().preferences.analytics).toBe(false);
  });

  it("saveCustom sets status customised and closes modal", () => {
    useConsentStore.getState().openModal();
    useConsentStore.getState().updatePreference("analytics", true);
    useConsentStore.getState().saveCustom();
    expect(useConsentStore.getState().status).toBe("customised");
    expect(useConsentStore.getState().modalOpen).toBe(false);
  });

  it("hasConsented returns false when category is false", () => {
    expect(useConsentStore.getState().hasConsented("analytics")).toBe(false);
  });

  it("hasConsented returns true after enabling that category", () => {
    useConsentStore.getState().updatePreference("analytics", true);
    expect(useConsentStore.getState().hasConsented("analytics")).toBe(true);
  });

  it("necessary preference stays true after rejectAll", () => {
    useConsentStore.getState().rejectAll();
    expect(useConsentStore.getState().preferences.necessary).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm test -- tests/audit/consent/consent-store.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/consent/store'`

- [ ] **Step 3: Create the store**

Create `src/lib/consent/store.ts`:

```ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConsentStatus = "pending" | "accepted" | "rejected" | "customised";

export interface ConsentPreferences {
  necessary: boolean; // always true — cannot be disabled
  analytics: boolean;
  marketing: boolean;
}

interface ConsentState {
  status: ConsentStatus;
  preferences: ConsentPreferences;
  modalOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  openModal: () => void;
  closeModal: () => void;
  updatePreference: (category: "analytics" | "marketing", value: boolean) => void;
  saveCustom: () => void;
  hasConsented: (category: "analytics" | "marketing") => boolean;
}

const DEFAULT_PREFERENCES: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      status: "pending",
      preferences: { ...DEFAULT_PREFERENCES },
      modalOpen: false,

      acceptAll: () =>
        set({
          status: "accepted",
          preferences: { necessary: true, analytics: true, marketing: true },
        }),

      rejectAll: () =>
        set({
          status: "rejected",
          preferences: { ...DEFAULT_PREFERENCES },
        }),

      openModal: () => set({ modalOpen: true }),
      closeModal: () => set({ modalOpen: false }),

      updatePreference: (category, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [category]: value },
        })),

      saveCustom: () => set({ status: "customised", modalOpen: false }),

      hasConsented: (category) => get().preferences[category] === true,
    }),
    {
      name: "cookie-consent-v1",
      // modalOpen is transient UI state — do not persist
      partialize: (state) => ({
        status: state.status,
        preferences: state.preferences,
      }),
    }
  )
);
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- tests/audit/consent/consent-store.test.ts
```

Expected: PASS — 10 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/consent/store.ts tests/audit/consent/consent-store.test.ts
git commit -m "feat(consent): add Zustand consent store with POPIA-compliant state transitions"
```

---

### Task 2: Cookie Banner

**Files:**
- Create: `src/components/consent/CookieBanner.tsx`

The banner is a fixed-bottom bar that appears only when `status === "pending"`. It has three equal-weight buttons: Reject All, Customise, Accept All. Dark theme matches the site's `#050d14` background. Non-blocking — users can still interact with the page behind it.

- [ ] **Step 1: Create the component**

Create `src/components/consent/CookieBanner.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useConsentStore } from "@/lib/consent/store";

export default function CookieBanner() {
  const status = useConsentStore((s) => s.status);
  const acceptAll = useConsentStore((s) => s.acceptAll);
  const rejectAll = useConsentStore((s) => s.rejectAll);
  const openModal = useConsentStore((s) => s.openModal);

  if (status !== "pending") return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#050d14] border-t border-white/10 px-4 py-4 md:py-5"
    >
      <div className="max-w-5xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-white/70 leading-relaxed">
          We use cookies to keep you logged in and remember your preferences.{" "}
          <Link
            href="/cookie-policy"
            className="text-white underline hover:text-white/80 transition-colors"
          >
            Cookie Policy
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={rejectAll}
            className="text-xs font-semibold px-4 py-2 border border-white/20 rounded text-white/70 hover:bg-white/5 transition-colors"
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-semibold px-4 py-2 border border-white/20 rounded text-white/70 hover:bg-white/5 transition-colors"
          >
            Customise
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="text-xs font-semibold px-4 py-2 bg-white text-[#050d14] rounded hover:bg-white/90 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/consent/CookieBanner.tsx
git commit -m "feat(consent): add CookieBanner component"
```

---

### Task 3: Preferences Modal

**Files:**
- Create: `src/components/consent/PreferencesModal.tsx`

A centered overlay modal with per-category toggles. "Necessary" is locked and always on. "Analytics" and "Marketing" are optional. Each category shows a description. The modal can be opened from the banner's "Customise" button or the footer's "Cookie Settings" link.

- [ ] **Step 1: Create the component**

Create `src/components/consent/PreferencesModal.tsx`:

```tsx
"use client";

import { useConsentStore } from "@/lib/consent/store";

const CATEGORIES = [
  {
    key: "necessary" as const,
    label: "Strictly Necessary",
    description:
      "Session authentication cookies required for you to log in and use the portal. Cannot be disabled.",
    locked: true,
  },
  {
    key: "analytics" as const,
    label: "Analytics",
    description:
      "Help us understand how visitors use the site so we can improve it. No data is sold to third parties.",
    locked: false,
  },
  {
    key: "marketing" as const,
    label: "Marketing",
    description:
      "Allow us to show you relevant promotions. No data is sold to third parties.",
    locked: false,
  },
];

export default function PreferencesModal() {
  const modalOpen = useConsentStore((s) => s.modalOpen);
  const preferences = useConsentStore((s) => s.preferences);
  const closeModal = useConsentStore((s) => s.closeModal);
  const updatePreference = useConsentStore((s) => s.updatePreference);
  const saveCustom = useConsentStore((s) => s.saveCustom);

  if (!modalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-slate-900">Cookie Preferences</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose which cookies you allow. You can change these at any time via the Cookie
            Settings link in the footer.
          </p>
        </div>

        {/* Category toggles */}
        <div className="px-6 py-4 space-y-5">
          {CATEGORIES.map(({ key, label, description, locked }) => {
            const checked = key === "necessary" ? true : preferences[key];
            return (
              <div key={key} className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`${label} cookies`}
                  disabled={locked}
                  onClick={() => {
                    if (!locked && key !== "necessary") {
                      updatePreference(key, !preferences[key]);
                    }
                  }}
                  className={[
                    "relative flex-shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors",
                    checked ? "bg-slate-900" : "bg-slate-200",
                    locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                      checked ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={closeModal}
            className="text-xs font-semibold px-4 py-2 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveCustom}
            className="text-xs font-semibold px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/consent/PreferencesModal.tsx
git commit -m "feat(consent): add PreferencesModal with per-category toggles"
```

---

### Task 4: Cookie Policy Page

**Files:**
- Create: `src/app/cookie-policy/page.tsx`

A public static page accessible to both authenticated and unauthenticated users. Lists all cookies in a table. Follows the same layout as `src/app/terms/page.tsx` — portal NavBar for logged-in users, PublicNavBar + spacer for public users.

- [ ] **Step 1: Create the page**

Create `src/app/cookie-policy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import NavBar from "@/components/portal/NavBar";
import PublicNavBar from "@/components/PublicNavBar";
import type { AppRole } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Cookie Policy | AR Steel Manufacturing",
  description:
    "How AR Steel Manufacturing uses cookies on the B2B Ordering Portal.",
};

export default async function CookiePolicyPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {session ? (
        <NavBar
          role={session.role as AppRole | undefined}
          businessName={session.businessName}
        />
      ) : (
        <>
          <PublicNavBar />
          <div className="h-[72px] flex-shrink-0" aria-hidden="true" />
        </>
      )}

      <div className="px-6 py-16 flex-1">
        <div className="max-w-3xl mx-auto space-y-10 text-slate-700">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
              Cookie Policy
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Effective date: 1 April 2025 &nbsp;&middot;&nbsp; Jurisdiction:
              Republic of South Africa
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">What are cookies?</h2>
            <p className="text-sm leading-relaxed">
              Cookies are small text files placed on your device when you visit a website.
              They help the site remember information about your visit so it can function
              correctly and provide a better experience.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Cookies we use</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Cookie / Key
                    </th>
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Category
                    </th>
                    <th className="text-left py-3 pr-6 font-semibold text-slate-900">
                      Purpose
                    </th>
                    <th className="text-left py-3 font-semibold text-slate-900">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      sb-buyer-session
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Authenticates your buyer account session
                    </td>
                    <td className="py-3">Session</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      sb-* (Supabase Auth)
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Authenticates administrator accounts
                    </td>
                    <td className="py-3">Session</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-mono text-xs text-slate-600">
                      cookie-consent-v1
                    </td>
                    <td className="py-3 pr-6">Strictly Necessary</td>
                    <td className="py-3 pr-6">
                      Stores your cookie consent preferences (localStorage — not a cookie)
                    </td>
                    <td className="py-3">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500">
              We do not currently use analytics, advertising, or third-party tracking cookies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Your choices</h2>
            <p className="text-sm leading-relaxed">
              You can update your cookie preferences at any time using the{" "}
              <strong>Cookie Settings</strong> link in the footer of any page.
              Strictly necessary cookies cannot be disabled as they are required for the
              portal to function.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
            <p className="text-sm leading-relaxed">
              For questions about this Cookie Policy, contact our Information Officer at{" "}
              <a
                href="mailto:info@armanufacturing.co.za"
                className="text-slate-900 underline hover:text-slate-700"
              >
                info@armanufacturing.co.za
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/cookie-policy/page.tsx
git commit -m "feat(consent): add /cookie-policy page"
```

---

### Task 5: Wire Up Banner, Modal, Footer Links, and Terms Update

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/terms/page.tsx`

This task mounts the banner and modal in the root shell, adds Cookie Policy + Cookie Settings links to the landing page footer, and updates the privacy copy in Section 9 of Terms.

- [ ] **Step 1: Mount CookieBanner and PreferencesModal in root layout**

Current `src/app/layout.tsx` body:
```tsx
<body className={`${inter.variable} font-inter antialiased`}>
  {children}
</body>
```

Replace with:
```tsx
import CookieBanner from "@/components/consent/CookieBanner";
import PreferencesModal from "@/components/consent/PreferencesModal";

// ...

<body className={`${inter.variable} font-inter antialiased`}>
  {children}
  <CookieBanner />
  <PreferencesModal />
</body>
```

Full updated `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/consent/CookieBanner";
import PreferencesModal from "@/components/consent/PreferencesModal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AR Steel Manufacturing",
  description: "Precision-manufactured steel products and hardware solutions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" style={{ colorScheme: "light" }}>
      <body className={`${inter.variable} font-inter antialiased`}>
        {children}
        <CookieBanner />
        <PreferencesModal />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add Cookie Policy link and Cookie Settings button to landing page footer**

In `src/app/page.tsx`, add `useConsentStore` import at the top with other imports:

```tsx
import { useConsentStore } from "@/lib/consent/store";
```

Locate the Legal `<ul>` section (around line 289). It currently ends after the Delivery Terms `<li>`. Add two new list items immediately after:

```tsx
{/* Current last item in the Legal ul: */}
<li>
  <Link href="/terms#delivery" className="hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm">
    Delivery Terms
  </Link>
</li>
{/* ADD THESE TWO: */}
<li>
  <Link href="/cookie-policy" className="hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm">
    Cookie Policy
  </Link>
</li>
<li>
  <button
    type="button"
    onClick={() => useConsentStore.getState().openModal()}
    className="text-left hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 rounded-sm"
  >
    Cookie Settings
  </button>
</li>
```

- [ ] **Step 3: Update Section 9 in terms/page.tsx**

Find lines 275–276 in `src/app/terms/page.tsx`:
```tsx
The Portal uses strictly necessary session cookies to authenticate your
account. No tracking, advertising, or analytics cookies are used.
```

Replace with:
```tsx
The Portal uses strictly necessary session cookies to authenticate your
account. For full details on cookies used and to manage your preferences,
see our{" "}
<a href="/cookie-policy" className="text-slate-700 underline hover:text-slate-900 transition-colors">
  Cookie Policy
</a>
.
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all existing tests still pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/terms/page.tsx
git commit -m "feat(consent): wire up banner, modal, footer links, and update terms Section 9"
```

---

## Post-Implementation: Script Gating Architecture

No third-party scripts exist today, but when they are added, the gating pattern is:

```tsx
// In any component that loads an analytics script:
"use client";
import { useConsentStore } from "@/lib/consent/store";

export function AnalyticsLoader() {
  const hasConsented = useConsentStore((s) => s.hasConsented("analytics"));
  if (!hasConsented) return null;
  return <Script src="..." strategy="afterInteractive" />;
}
```

Mount `<AnalyticsLoader />` in `src/app/layout.tsx` alongside `<CookieBanner />` when analytics are added.
