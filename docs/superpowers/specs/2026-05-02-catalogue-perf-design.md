# Catalogue Performance & Navigation Speed Design

**Date:** 2026-05-02  
**Status:** Approved

---

## Problem

Two independent slowness issues have been identified:

### 1. `/catalogue` page is slow for everyone

The catalogue page (`src/app/catalogue/page.tsx`) runs a server-side session check + sequential `business_name` DB fetch on every single visit — including public (unauthenticated) users. This blocks the entire page from rendering until both complete. The page contains only static image content (11 webp files), yet it behaves as a fully dynamic server-rendered page with DB dependencies.

Additionally, because `/catalogue` lives outside the `(portal)` route group, navigating from the portal to the catalogue causes the portal layout to unmount and a new NavBar to render from scratch — creating a jarring transition.

### 2. Portal layout has a sequential DB waterfall

In `src/app/(portal)/layout.tsx`, `getSession()` and the global banner fetch run in parallel — but `business_name` is then fetched **sequentially after** they resolve. Nothing in the nav chrome renders until all three operations complete. This waterfall affects every cold portal load.

---

## Constraints

- No visual design changes to either `NavBar` or `PublicNavBar`. Both components are unchanged. Once fully loaded, they must look identical to their current appearance.
- All 11 catalogue images remain eager-loaded (intentional — users scroll fast).
- Single URL `/catalogue` must work for both authenticated and public users.
- No new dependencies.

---

## Solution

### Option A — Catalogue: ISR + Client-side NavBar Hydration

**Core idea:** The catalogue image grid is static content. Remove the server-side session dependency from the page entirely. Add `export const revalidate = 86400` so Next.js serves the page from its ISR cache. Move NavBar selection to the client.

**How the client NavBar works:**
1. A lightweight API route `/api/auth/nav-state` returns `{ isAuthenticated, role, businessName }` using the existing `getSession()` — no new auth logic.
2. A new `<CatalogueNavBar>` client component fetches this route on mount, shows a `div` placeholder (`h-[72px]`, same height as both NavBars) while the single API call resolves, then mounts the correct NavBar.
3. The mounted NavBar is the **exact same component** as always — `<NavBar>` for portal users, `<PublicNavBar activeItem="catalogue" />` for public users — with the same props they receive today.

**Result:**
- Page renders from ISR cache in milliseconds for everyone.
- NavBar appears ~50–100ms after page paint (one cached API call to localhost).
- Both NavBars look identical to their current appearance once mounted.
- For portal users navigating within the portal, the browser cache for `/api/auth/nav-state` means near-instant NavBar hydration on repeat visits.

**API route caching:**
- `Cache-Control: private, max-age=60, stale-while-revalidate=300`
- Private (never CDN-cached — contains user-specific data).
- 60-second browser cache means the NavBar state is re-checked at most once per minute.

**Placeholder behaviour:**
- The `h-[72px]` placeholder matches the rendered height of both NavBars exactly.
- No layout shift.
- On the portal NavBar (white bg), the placeholder is a white bar — invisible.
- On the PublicNavBar (dark bg), the placeholder is white for ~50–100ms before the dark bar appears. Acceptable given current experience is a blank page for multiple seconds.

### Option C — Session: businessName Baked Into Resolution

**Core idea:** `getSession()` always returns `businessName`. No caller ever needs a separate DB query for it.

**Changes to `session.ts`:**
- Supabase Auth path: add `business_name` to the existing `profiles` select (zero extra DB calls — we already query profiles in this path).
- Buyer JWT path: after verifying the JWT, fetch `business_name` from profiles (one DB call, but this replaces the one currently done in `layout.tsx`). Net DB calls: unchanged.
- `ActiveSession` interface gains `businessName: string | null`.

**Changes to `layout.tsx`:**
- Remove the sequential `profiles.business_name` fetch entirely.
- Use `session.businessName` directly.
- Cold load eliminates one sequential DB round-trip.

**Changes to `buyer.ts`:**
- `BuyerSessionPayload` and `VerifiedBuyerSession` types remain as-is. businessName is resolved in `session.ts` after JWT verification, not embedded in the JWT (avoids stale-name issues if admin updates business name).

### Loading skeleton for `/catalogue`

Add `src/app/catalogue/loading.tsx` — a skeleton that shows while the server responds on the very first (non-cached) hit. On cached hits this is essentially never seen.

---

## Security Considerations

- `/api/auth/nav-state` returns only display data (role, businessName). No tokens, no IDs, no write capability.
- The route calls `getSession()` which performs full JWT verification — no auth logic is bypassed.
- `Cache-Control: private` ensures the response is never cached by a CDN or shared proxy.
- The ISR catalogue page serves only static public content (webp images). It was already publicly accessible — there is no security regression.
- Removing the server-side session check from the catalogue page does not expose anything that wasn't already public.

---

## Files Affected

| File | Action | Reason |
|------|--------|--------|
| `src/lib/auth/session.ts` | Modify | Add `businessName` to `ActiveSession`, resolve in both auth paths |
| `src/app/(portal)/layout.tsx` | Modify | Remove sequential businessName fetch, use `session.businessName` |
| `src/app/api/auth/nav-state/route.ts` | Create | Lightweight endpoint for client-side NavBar hydration |
| `src/components/catalogue/CatalogueNavBar.tsx` | Create | Client component that selects and renders correct NavBar |
| `src/app/catalogue/page.tsx` | Modify | Remove session check, add ISR, use `<CatalogueNavBar>` |
| `src/app/catalogue/loading.tsx` | Create | Skeleton for first uncached hit |

---

## What Does Not Change

- `NavBar.tsx` — untouched
- `PublicNavBar.tsx` — untouched
- All 11 catalogue images and their loading strategy — untouched
- The URL `/catalogue` — unchanged, serves both audiences
- Visual appearance of both NavBars once rendered — identical to today
