# Catalogue Performance & Navigation Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/catalogue` load near-instantly from ISR cache and eliminate the portal layout's sequential `business_name` DB waterfall.

**Architecture:** Move `businessName` resolution into `getSession()` so no caller needs a separate DB call. Strip the server-side session check from `/catalogue`, make it ISR-cached, and hydrate the NavBar client-side via a lightweight API route. Both `NavBar` and `PublicNavBar` components are untouched — only their mount point changes.

**Tech Stack:** Next.js 16 App Router, React 19, `jose` (already used for JWT), TypeScript, Supabase admin client, Zustand (no changes).

---

## File Map

| File | Action |
|------|--------|
| `src/lib/auth/session.ts` | Modify — add `businessName` to `ActiveSession`, resolve in both auth paths |
| `src/app/(portal)/layout.tsx` | Modify — remove sequential `business_name` fetch, use `session.businessName` |
| `src/app/api/auth/nav-state/route.ts` | Create — returns `{ isAuthenticated, role, businessName }` |
| `src/components/catalogue/CatalogueNavBar.tsx` | Create — client component that fetches API route and mounts correct NavBar |
| `src/app/catalogue/page.tsx` | Modify — remove session check, add `revalidate`, use `<CatalogueNavBar>` |
| `src/app/catalogue/loading.tsx` | Create — skeleton for uncached first hit |

---

## Task 1: Add `businessName` to session resolution

**Files:**
- Modify: `src/lib/auth/session.ts`

### Context

`session.ts` exports `getSession()` which is wrapped in React's `cache()` — it deduplicates calls within a single server request. It resolves sessions via two paths:
1. **Buyer JWT path** — reads `sb-buyer-session` cookie, calls `verifyBuyerSession()`, returns session without any DB call for businessName.
2. **Supabase Auth path** — calls `supabase.auth.getUser()`, then queries `profiles` table.

We add `businessName` to `ActiveSession` and resolve it in both paths. Net DB call count is unchanged — we're moving an existing call from `layout.tsx` into `session.ts`.

- [ ] **Step 1: Open `src/lib/auth/session.ts` and add `businessName` to the `ActiveSession` interface**

Replace the `ActiveSession` interface (currently at the top of the file) with:

```ts
export interface ActiveSession {
  profileId: string;
  role: AppRole;
  accountNumber: string | null;
  businessName: string | null; // <-- NEW
  isBuyer: boolean;
  isAdmin: boolean;
  adminRole: "manager" | "employee" | null;
  isSuperAdmin: boolean;
  token: string | null;
}
```

- [ ] **Step 2: Update the buyer JWT path to resolve `businessName`**

In `_resolveSession`, find the buyer JWT block (starts with `const buyerCookie = store.get(BUYER_SESSION_COOKIE)`). After `verifyBuyerSession` returns a session, fetch `business_name` from profiles. Replace the return statement in that block:

```ts
const buyerCookie = store.get(BUYER_SESSION_COOKIE);
if (buyerCookie?.value) {
  const session = await verifyBuyerSession(buyerCookie.value);
  if (session) {
    const { data: buyerProfile } = await adminClient
      .from("profiles")
      .select("business_name")
      .eq("id", session.profileId)
      .single();

    return {
      profileId: session.profileId,
      role: session.role,
      accountNumber: session.accountNumber,
      businessName: buyerProfile?.business_name ?? null,
      isBuyer: true,
      isAdmin: false,
      adminRole: null,
      isSuperAdmin: false,
      token: session.token,
    };
  }
}
```

- [ ] **Step 3: Update the Supabase Auth path to include `business_name` in the existing profiles query**

Find the existing `adminClient.from("profiles").select("id, role, account_number, admin_role")` call in the Supabase Auth path and add `business_name` to the select. Update the return statement:

```ts
const { data: profile } = await adminClient
  .from("profiles")
  .select("id, role, account_number, admin_role, business_name")
  .eq("auth_user_id", user.id)
  .single();

if (profile) {
  const superEmails = (process.env.ADMIN_SUPER_EMAIL || "").split(",").map((e) => e.trim()).filter(Boolean);
  return {
    profileId: profile.id,
    role: profile.role,
    accountNumber: profile.account_number,
    businessName: profile.business_name ?? null,
    isBuyer: profile.role !== "admin",
    isAdmin: profile.role === "admin",
    adminRole: profile.admin_role ?? null,
    isSuperAdmin: !!user.email && superEmails.includes(user.email),
    token: null,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
cd /Users/lukepetzer/LP-Web-Studio/Clients/Rasheed-B2B/Codebase/rasheed-ordering-portal
npx tsc --noEmit 2>&1 | head -40
```

Expected: errors only if other callers of `ActiveSession` need updating (e.g. if something destructures the type). Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(session): add businessName to ActiveSession, resolve in both auth paths"
```

---

## Task 2: Update portal layout to use `session.businessName`

**Files:**
- Modify: `src/app/(portal)/layout.tsx`

### Context

The layout currently fetches `business_name` **after** session + banner resolve — a sequential waterfall. Now that `session.businessName` exists, we remove this extra fetch entirely.

- [ ] **Step 1: Remove the sequential `business_name` fetch from `layout.tsx`**

Replace the entire `layout.tsx` default export body with the version below. The `businessName` line no longer hits the DB — it reads from the session object returned by `getSession()`:

```tsx
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, { data: settings, error: bannerError }] = await Promise.all([
    getSession(),
    adminClient
      .from("global_settings")
      .select("banner_message, is_banner_active")
      .eq("id", 1)
      .single(),
  ]);

  if (bannerError) {
    console.error("[portal/layout] global_settings fetch failed:", bannerError.message);
  }

  if (!session) redirect("/login");

  const showBanner =
    settings?.is_banner_active === true &&
    typeof settings.banner_message === "string" &&
    settings.banner_message.trim().length > 0;

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-white">
      <CartGuard />
      {showBanner && <GlobalBanner message={settings!.banner_message!} />}
      <NavBar role={session?.role as AppRole | undefined} businessName={session?.businessName ?? null} />
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
      <footer className="flex-shrink-0 border-t border-gray-100 bg-white px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11px] text-gray-400">
          &copy; {new Date().getFullYear()} AR Steel Manufacturing (Pty) Ltd
        </p>
        <nav className="flex items-center gap-4 text-[11px] text-gray-400">
          <Link href="/terms" className="hover:text-gray-600 transition-colors">
            Terms
          </Link>
          <Link href="/terms#privacy" className="hover:text-gray-600 transition-colors">
            Privacy
          </Link>
          <Link href="/terms#returns" className="hover:text-gray-600 transition-colors">
            Returns
          </Link>
          <Link href="/terms#delivery" className="hover:text-gray-600 transition-colors">
            Delivery
          </Link>
        </nav>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(portal)/layout.tsx
git commit -m "perf(layout): eliminate sequential business_name fetch, use session.businessName"
```

---

## Task 3: Create `/api/auth/nav-state` route

**Files:**
- Create: `src/app/api/auth/nav-state/route.ts`

### Context

This is the lightweight endpoint the `<CatalogueNavBar>` client component calls. It uses `getSession()` — the same function already used everywhere — and returns only display data needed to choose which NavBar to render. It is not an auth endpoint; it cannot be used to gain access to anything.

Response shape: `{ isAuthenticated: boolean; role: string | null; businessName: string | null }`

Cache headers: `private, max-age=60, stale-while-revalidate=300` — browser caches for 60 seconds, allowing stale responses for 5 minutes. Never cached by a CDN (private).

- [ ] **Step 1: Create the directory and file**

Create `src/app/api/auth/nav-state/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  const response = NextResponse.json({
    isAuthenticated: session !== null,
    role: session?.role ?? null,
    businessName: session?.businessName ?? null,
  });

  response.headers.set(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=300"
  );

  return response;
}
```

- [ ] **Step 2: Verify the route is reachable**

Start the dev server and test:

```bash
curl http://localhost:3000/api/auth/nav-state
```

Expected (unauthenticated): `{"isAuthenticated":false,"role":null,"businessName":null}`
Expected (authenticated buyer): `{"isAuthenticated":true,"role":"buyer_default","businessName":"Acme Corp"}`

- [ ] **Step 3: Confirm the route is excluded from proxy auth checks**

Open `src/proxy.ts` and verify the existing check `pathname.startsWith("/api")` returns early without auth. It does — line 49: `pathname.startsWith("/api")` → `NextResponse.next()`. No change needed.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/nav-state/route.ts
git commit -m "feat(api): add /api/auth/nav-state route for client-side NavBar hydration"
```

---

## Task 4: Create `<CatalogueNavBar>` client component

**Files:**
- Create: `src/components/catalogue/CatalogueNavBar.tsx`

### Context

This client component:
1. Fetches `/api/auth/nav-state` on mount (one GET, ~50ms to localhost, cached by browser).
2. Shows a `h-[72px]` placeholder `div` while loading — prevents layout shift, matches both NavBars' height.
3. Once data resolves, mounts either `<NavBar>` (authenticated) or `<PublicNavBar activeItem="catalogue" />` (public).

**Critical constraint:** Both NavBar components are imported and rendered exactly as they are today — no props changes, no visual modifications.

- [ ] **Step 1: Create the components directory and file**

Create `src/components/catalogue/CatalogueNavBar.tsx`:

```tsx
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

  return <PublicNavBar activeItem="catalogue" />;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/catalogue/CatalogueNavBar.tsx
git commit -m "feat(catalogue): add CatalogueNavBar client component for auth-aware NavBar hydration"
```

---

## Task 5: Convert catalogue page to ISR

**Files:**
- Modify: `src/app/catalogue/page.tsx`

### Context

Currently the page: imports `getSession`, fetches `business_name`, then conditionally renders `<NavBar>` or `<PublicNavBar>`. All of this is being removed. The page becomes a static image grid with `<CatalogueNavBar>` handling auth selection client-side.

`export const revalidate = 86400` makes Next.js cache the page for 24 hours. On first visit (cache miss), the page renders and the response is cached. Every subsequent visitor within 24 hours gets the cached response near-instantly. ISR pages are regenerated in the background after the TTL expires.

The `pt-[72px]` padding on the content wrapper currently only applies for non-authenticated users (when the PublicNavBar is `fixed` positioned and needs the content pushed down). Since `CatalogueNavBar` now always renders the NavBar in normal document flow when authenticated OR uses the fixed PublicNavBar when public, the padding logic stays inside `CatalogueNavBar` or we handle it in the page. See step 1 below for the correct approach.

Note: `PublicNavBar` uses `position: fixed` (`fixed top-0`), which means the page content sits behind it without padding. The original page had `pt-[72px]` only for public users (`!session`). We must preserve this behaviour.

- [ ] **Step 1: Rewrite `src/app/catalogue/page.tsx`**

Replace the entire file content with:

```tsx
import Image from "next/image";
import CatalogueNavBar from "@/components/catalogue/CatalogueNavBar";

export const revalidate = 86400;

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default function CataloguePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CatalogueNavBar />
      {/*
        Public users get PublicNavBar which is `fixed` positioned — the content
        needs top padding to sit below it. CatalogueNavBar renders a h-[72px]
        placeholder while loading, then the correct NavBar. For public users,
        the fixed PublicNavBar overlaps the placeholder. We add pt-[72px] to
        account for this — it has no effect for authenticated users since their
        NavBar is in normal document flow.
      */}
      <div className="flex-1 pt-[72px]">
        <div className="max-w-4xl mx-auto">
          {pages.map((page, i) => (
            <Image
              key={page.src}
              src={page.src}
              alt={page.alt}
              width={1240}
              height={1754}
              className="w-full h-auto block"
              sizes="(max-width: 896px) 100vw, 896px"
              priority={i === 0}
              loading={i === 0 ? undefined : "eager"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

> **Note on `pt-[72px]`:** Authenticated users (portal NavBar, `sticky`) are unaffected — their NavBar takes up space in document flow so no padding is needed. However, adding `pt-[72px]` for authenticated users adds 72px of extra space above the images. To avoid this, `CatalogueNavBar` should communicate its type to the parent, OR we accept a small visual difference (72px top padding for portal users on the catalogue page). The simplest correct fix: move the padding into `CatalogueNavBar`'s rendered output so only public users get it. See the revision in step 1a.

- [ ] **Step 1a: Move padding responsibility into `CatalogueNavBar`**

Update `src/components/catalogue/CatalogueNavBar.tsx` to return a wrapper that includes padding only for the public NavBar:

```tsx
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
        setNavState({ isAuthenticated: false, role: null, businessName: null });
      });
  }, []);

  if (navState === null) {
    // Placeholder height matches both NavBars; pt-[72px] covers the fixed
    // PublicNavBar case while we wait to know which NavBar we're rendering.
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
```

And update `src/app/catalogue/page.tsx` to remove the `pt-[72px]` from the content wrapper (since `CatalogueNavBar` now handles spacing):

```tsx
import Image from "next/image";
import CatalogueNavBar from "@/components/catalogue/CatalogueNavBar";

export const revalidate = 86400;

const TOTAL_PAGES = 11;

const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/catalogue/page-${n}.webp`, alt: `Catalogue page ${i + 1}` };
});

export default function CataloguePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <CatalogueNavBar />
      <div className="flex-1">
        <div className="max-w-4xl mx-auto">
          {pages.map((page, i) => (
            <Image
              key={page.src}
              src={page.src}
              alt={page.alt}
              width={1240}
              height={1754}
              className="w-full h-auto block"
              sizes="(max-width: 896px) 100vw, 896px"
              priority={i === 0}
              loading={i === 0 ? undefined : "eager"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Test both navigation paths manually**

Start the dev server:
```bash
npm run dev
```

Test 1 — Portal user:
1. Log in as a buyer at `/login`
2. Navigate to `/catalogue` via the NavBar link
3. Verify: portal NavBar appears (white background, logo, Order Sheet / Catalogue / Order History links)
4. Verify: business name shown in NavBar (if the buyer has one)
5. Verify: all 11 catalogue images visible

Test 2 — Public user:
1. Open an incognito window
2. Navigate directly to `/catalogue`
3. Verify: dark PublicNavBar appears (dark background, Services / Catalogue / Contact / Login links)
4. Verify: all 11 catalogue images visible

- [ ] **Step 4: Commit**

```bash
git add src/app/catalogue/page.tsx src/components/catalogue/CatalogueNavBar.tsx
git commit -m "perf(catalogue): convert to ISR, hydrate NavBar client-side via /api/auth/nav-state"
```

---

## Task 6: Add `loading.tsx` for `/catalogue`

**Files:**
- Create: `src/app/catalogue/loading.tsx`

### Context

On the very first visit (cache miss), Next.js runs the page server function. The `loading.tsx` Suspense boundary shows during this window. After the first visit the page is cached and `loading.tsx` is essentially never seen. The skeleton matches the visual structure: a 72px NavBar bar + image area.

- [ ] **Step 1: Create `src/app/catalogue/loading.tsx`**

```tsx
export default function CatalogueLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* NavBar placeholder */}
      <div className="h-[72px] flex-shrink-0 border-b border-gray-100 bg-white/80 animate-pulse" />

      {/* Image grid skeleton */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-full bg-slate-100 animate-pulse"
              style={{ aspectRatio: "1240 / 1754" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders by temporarily disabling ISR**

In `page.tsx`, temporarily change `revalidate` to `0` (force dynamic), visit `/catalogue`, and confirm the skeleton shows briefly before the page renders. Revert after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/app/catalogue/loading.tsx
git commit -m "feat(catalogue): add loading skeleton for uncached first hit"
```

---

## Task 7: End-to-end validation

- [ ] **Step 1: Run the full build to catch any type or compilation issues**

```bash
npm run build 2>&1 | tail -30
```

Expected: build completes successfully. The `/catalogue` route should be listed as a statically generated ISR page (indicated by `○` or `◐` in the build output, not `λ` which means dynamic).

- [ ] **Step 2: Verify the portal layout no longer has sequential DB calls**

Add a temporary `console.time` to `_resolveSession` in `session.ts` to confirm it now runs a single profiles query and the layout adds no additional DB round-trips. Remove after confirming.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "perf: catalogue ISR + client NavBar hydration + session businessName (Options A+C)"
```

---

## Self-review Checklist

- [x] **Spec coverage:** All spec requirements mapped — ISR (Task 5), client NavBar (Task 4), API route (Task 3), businessName in session (Task 1), layout waterfall fix (Task 2), loading.tsx (Task 6).
- [x] **Placeholder scan:** No TBDs. All code blocks are complete.
- [x] **Type consistency:** `NavState` interface in `CatalogueNavBar` matches the JSON shape returned by `/api/auth/nav-state/route.ts`. `ActiveSession.businessName` added in Task 1 is consumed in Task 2 and Task 3. `AppRole` imported from same source in all files.
- [x] **Padding issue:** Identified and resolved in Task 5 Step 1a — padding responsibility moved into `CatalogueNavBar` so portal users don't get unwanted top space.
- [x] **Proxy check:** Confirmed `/api` routes are already excluded from proxy auth in `proxy.ts` — no change needed.
- [x] **NavBars unchanged:** Both `NavBar.tsx` and `PublicNavBar.tsx` are not modified. `CatalogueNavBar` wraps them with identical props.
