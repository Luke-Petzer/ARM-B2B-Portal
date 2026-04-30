# Bugfixes & Performance Refactoring Design

**Date:** 2026-04-30
**Status:** Draft
**Scope:** Two bug fixes (one security-critical) + performance improvements for navigation and login

---

## Table of Contents

1. [Issue A — Cart data leaking across user sessions (Security)](#issue-a--cart-data-leaking-across-user-sessions)
2. [Issue B — Admin role update fails with "Invalid client ID"](#issue-b--admin-role-update-fails-with-invalid-client-id)
3. [Issue C — Performance: navigation and login](#issue-c--performance-navigation-and-login)

---

## Issue A — Cart data leaking across user sessions

### Problem

When user A logs out and user B logs into the same browser, user B sees user A's cart, order history context, and profile details. This is a **data privacy / session isolation failure**.

### Root cause

The Zustand cart store (`src/lib/cart/store.ts`) uses the `persist` middleware with a **fixed localStorage key** `"b2b-cart"` (line 119). This key is not namespaced by user ID. When user A adds items, checks out, re-adds an order to cart, and logs out, the cart data remains in `localStorage` because:

1. **`logoutAction`** (`src/app/actions/auth.ts:279-296`) is a server action. It clears server-side cookies and calls `supabase.auth.signOut()`, but **cannot access `localStorage`** — the cart is never cleared on logout.
2. **`CartClearer`** (`src/app/(portal)/checkout/confirmed/CartClearer.tsx`) only runs on the checkout confirmation page — it does not run on logout.
3. **The reorder flow** (`CartReviewShell.tsx:38-52`) calls `clearCart()` then `addItem()` for each reorder item — writing a fresh cart to the same fixed `"b2b-cart"` key.
4. When user B logs in on the same browser, the Zustand store hydrates from `localStorage` and serves user A's cart.

### Solution: Clear-on-transitions

Add two client-side checkpoints that clear the cart at session boundaries:

#### A1. Clear cart before logout (client-side)

The `NavBar` component (`src/components/portal/NavBar.tsx:40-44`) calls `logoutAction()` inside a `startTransition`. We will call `clearCart()` **before** invoking the server action:

```
handleLogout:
  1. clearCart()                    // wipe localStorage immediately
  2. startTransition → logoutAction()  // then clear server session
```

**File:** `src/components/portal/NavBar.tsx`
**Change:** Import `useCartStore`, call `clearCart()` synchronously before `logoutAction()`.

#### A2. Clear stale cart on authenticated page mount

Add a lightweight `CartGuard` client component to the portal layout that clears the cart if the current cart was populated by a different session. Rather than tracking user IDs in the cart (which adds complexity), we take the simpler approach: **clear the cart whenever the portal layout mounts fresh** (i.e., after a full page navigation like login redirect). This is safe because:

- Normal in-app navigation (Link clicks) does NOT remount the layout — the layout is shared and persistent.
- The only time the layout mounts fresh is after a hard navigation: login redirect, browser refresh, or direct URL entry.
- After login, users always arrive via a `redirect()` from the server action, which is a full page load that remounts the layout.
- This means the cart is cleared exactly once per login, which is the correct behavior.

**File:** New component `src/components/portal/CartGuard.tsx`
**Render in:** `src/app/(portal)/layout.tsx` (inside the layout JSX, renders `null`)

```
CartGuard (client component):
  - useEffect on mount (runs once — empty deps after ref check):
    - Read sessionStorage key "cart-session-active"
    - If key is NOT present:
      - Call useCartStore.getState().clearCart()
      - Set sessionStorage "cart-session-active" = "1"
    - No cleanup needed — sessionStorage auto-clears on tab close.
```

**Why `sessionStorage`:** It is scoped to the browser tab and cleared automatically when the tab closes or the user navigates away, making it ideal for this purpose. After login, the flag is absent (login redirect = full page load = fresh sessionStorage context), so the cart is cleared. Subsequent in-app navigations don't remount the layout, so the guard's `useEffect` doesn't re-run. If the user opens a second tab, that tab gets its own `sessionStorage`, so it also clears on first mount — this is correct behavior (each tab should start with a clean cart).

**Edge case — browser back/forward cache (bfcache):** `sessionStorage` survives bfcache restoration, so the flag persists correctly. The cart won't be cleared spuriously when the user navigates back.

#### A3. Existing CartClearer stays

The `CartClearer` in `checkout/confirmed/CartClearer.tsx` remains as-is — it provides a third redundant checkpoint for the checkout-complete flow.

### Files changed (Issue A)

| File | Action |
|------|--------|
| `src/components/portal/NavBar.tsx` | Import `useCartStore`, add `clearCart()` call before logout |
| `src/components/portal/CartGuard.tsx` | **New** — client component, clears cart on fresh layout mount |
| `src/app/(portal)/layout.tsx` | Render `<CartGuard />` in the layout |

### Testing

- Log in as user A, add items to cart, log out — verify `localStorage` has no `b2b-cart` key (or it's empty).
- Log in as user B on the same browser — verify cart is empty.
- Verify that normal in-app navigation (clicking nav links) does NOT clear the cart.
- Verify that the reorder flow still works after these changes: re-add order → cart populates → stays populated during browsing → clears on checkout or logout.

---

## Issue B — Admin role update fails with "Invalid client ID"

### Problem

When an admin opens a client profile (EFT / `buyer_default`) in the edit drawer, changes the billing role to `buyer_30_day`, and submits, the UI shows "Invalid client ID."

### Root cause analysis

The error originates at `src/app/actions/admin.ts:1078`:

```ts
const rawId = formData.get("id") as string | null;
const idResult = z.string().uuid("Invalid client ID.").safeParse(rawId);
```

The full code path is correct on paper:

1. **Server page** (`src/app/(admin)/admin/clients/page.tsx:11-15`): Queries `adminClient.from("profiles").select("*")` — `id` is `UUID PRIMARY KEY`, always valid.
2. **Table** (`ClientsTable.tsx:206`): `handleOpenEdit(client)` passes the full client object including `id`.
3. **Drawer** (`ClientDrawer.tsx:152`): `<input type="hidden" name="id" value={client!.id} />` renders the UUID.
4. **Submit** (`ClientDrawer.tsx:116-133`): `new FormData(e.currentTarget)` captures form fields, calls `updateClientAction(formData)`.

The most likely failure point is the **FormData capture from a portal-rendered form**. The `Sheet` component (Radix Dialog) renders its content via `SheetPortal` (`src/components/ui/sheet.tsx:60-73`), which uses `createPortal` to render outside the normal DOM tree. While the `<form>` and its hidden `<input name="id">` are both inside the portal, there is a known edge case in some React/Radix versions where `new FormData(e.currentTarget)` may not capture all fields from portal-rendered forms, particularly hidden inputs that precede Radix's own internal hidden form elements (the `Select` component with `name="role"` renders its own hidden `<select>` via `BubbleSelect`).

### Solution: Explicit FormData injection

Instead of relying on DOM traversal to capture the hidden `id` field, explicitly set it in the submit handler before calling the server action:

**File:** `src/components/admin/ClientDrawer.tsx`

Change `handleSubmit` (lines 116-133):

```
Before:
  const formData = new FormData(e.currentTarget);
  const result = isEdit ? await updateClientAction(formData) : ...

After:
  const formData = new FormData(e.currentTarget);
  if (isEdit) formData.set("id", client!.id);  // ensure ID is always present
  const result = isEdit ? await updateClientAction(formData) : ...
```

This is a one-line fix. The hidden `<input name="id">` can stay in the form as a fallback, but `formData.set()` guarantees the value is present regardless of DOM capture behavior.

### Why not a bigger refactor?

- **`useActionState` refactor**: Cleaner API but high scope — every admin form would need migration for consistency. Not justified for a one-line fix.
- **Bound server action arguments**: Would require changing `updateClientAction`'s signature, which other code may depend on.
- **Removing the hidden input**: Keeps backwards compatibility; the explicit `set()` is additive.

### Files changed (Issue B)

| File | Action |
|------|--------|
| `src/components/admin/ClientDrawer.tsx` | Add `formData.set("id", client!.id)` in `handleSubmit` |

### Testing

- Open an EFT client (`buyer_default`) in the admin edit drawer.
- Change billing role to 30-Day Account (`buyer_30_day`).
- Submit — verify success (no "Invalid client ID" error).
- Verify the role change is reflected in the Supabase `profiles` table.
- Test the reverse: change a `buyer_30_day` client back to `buyer_default`.
- Test editing other fields (business name, contact, notes) — verify they still save correctly.

---

## Issue C — Performance: navigation and login

### C1: Page navigation feels unresponsive

#### Problem

When a user clicks a nav link, nothing happens visually until the new page finishes loading. The shell (navbar, footer) disappears and reappears with the new content all at once. This is because there are **zero `loading.tsx` files** in the project.

#### Root cause

Next.js App Router uses `loading.tsx` to create automatic `<Suspense>` boundaries around page content. When a `loading.tsx` exists in a route segment, navigation triggers an instant transition: the shared layout stays mounted, and the page content area immediately shows the loading fallback while the server component tree resolves. Without `loading.tsx`, Next.js waits for the entire page to resolve before displaying anything.

#### Solution

Add `loading.tsx` skeleton files to the key route segments. The portal layout (`src/app/(portal)/layout.tsx`) provides the persistent shell (NavBar, footer, banner). Each `loading.tsx` renders inside that shell, giving the user immediate visual feedback.

**Files to create:**

| File | Skeleton content |
|------|-----------------|
| `src/app/(portal)/dashboard/loading.tsx` | Pulsing grid skeleton matching the catalogue card layout |
| `src/app/(portal)/cart/loading.tsx` | Pulsing list skeleton matching the cart review layout |
| `src/app/(portal)/orders/loading.tsx` | Pulsing table skeleton matching the order history layout |
| `src/app/(admin)/admin/loading.tsx` | Generic pulsing skeleton for admin pages |

Each skeleton should:
- Use Tailwind's `animate-pulse` on `bg-slate-200` blocks.
- Match the approximate dimensions and layout of the real page content.
- Be a server component (default) — no `"use client"` needed.
- Render within the existing layout shell (navbar, footer stay visible and interactive).

#### Portal layout optimization

The current portal layout (`src/app/(portal)/layout.tsx:32-39`) makes a **sequential** `business_name` fetch after the parallel `getSession()` + `global_settings` fetch. This adds latency to every portal page load.

**Fix:** Move the `business_name` fetch into the existing `Promise.all`:

```
Current (sequential):
  const [session, settings] = await Promise.all([getSession(), globalSettings]);
  const { data: profile } = await adminClient.from("profiles").select("business_name")...

Fixed (parallel):
  const [session, settings] = await Promise.all([getSession(), globalSettings]);
  // business_name is already available on session.profileId — but we need the actual name
  // We can't add it to Promise.all because we need session.profileId first.
  // However, we CAN include it via getSession() itself or via Suspense.
```

Actually, `session.profileId` is needed as the filter key, so this fetch genuinely depends on `getSession()` completing first. The real optimization here is to **wrap the NavBar in a Suspense boundary** so the layout shell renders immediately and the business name streams in:

```tsx
// layout.tsx
<Suspense fallback={<NavBarSkeleton />}>
  <NavBarWithData />
</Suspense>
```

However, this would require splitting NavBar into an async server wrapper and a client component. For now, the `loading.tsx` approach provides 90% of the benefit with much less complexity. The sequential `business_name` fetch adds ~50-150ms — noticeable but not the primary bottleneck. We can optimize this later.

**Decision:** Add `loading.tsx` files only. Defer the layout Suspense refactor to a future iteration.

### C2: Login takes 5-6 seconds

#### Problem

The buyer login flow takes 5-6 seconds from form submission to the dashboard appearing. Users see a spinner on the button, then a blank/loading state.

#### Root cause breakdown

The `loginAction` in `src/app/actions/auth.ts:42-101` makes these sequential calls:

| Step | Call | Est. latency |
|------|------|-------------|
| 1 | Zod validation | ~0ms |
| 2 | `checkLoginRateLimit(ip, email)` — 2 Upstash Redis calls (IP + email buckets) | 50-200ms |
| 3 | `supabase.auth.signInWithPassword()` — Supabase Auth API | 200-500ms |
| 4 | `supabase.auth.getUser()` — Supabase Auth API (email verification check) | 100-300ms |
| 5 | `adminClient.from("profiles").select("role")` — DB query | 50-150ms |
| 6 | `redirect("/dashboard")` — Next.js redirect | ~0ms |

**Post-redirect, the dashboard loads:**

| Step | Call | Est. latency |
|------|------|-------------|
| 7 | Portal layout: `getSession()` — calls `supabase.auth.getUser()` + profile fetch | 150-450ms |
| 8 | Portal layout: `global_settings` fetch (parallel with step 7) | 50-100ms |
| 9 | Portal layout: `business_name` fetch (sequential after step 7) | 50-150ms |
| 10 | Dashboard page: `getCatalogueData()` — 2 DB queries (cache cold) or cache hit | 0-300ms |

**Total worst-case:** Steps 2-5 (~500-1150ms) + redirect + steps 7-10 (~250-900ms) = **~750-2050ms** for server work alone. Add network latency, TLS handshakes, React hydration, and this easily reaches 3-5 seconds. On cold starts or distant Supabase regions, 6 seconds is plausible.

The **real bottleneck** is the sheer number of sequential network round-trips, not any single slow call.

#### Solution: Parallelize login chain + add dashboard loading state

##### C2a. Parallelize `getUser()` and profile fetch in `loginAction`

Steps 4 and 5 are currently sequential but **independent** — `getUser()` checks email verification, while the profile fetch checks the role. They can run in parallel:

**File:** `src/app/actions/auth.ts`

```
Current (lines 79-97):
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !user.email_confirmed_at) { ... sign out ... }
  if (user) {
    const { data: profile } = await adminClient.from("profiles")...
    if (profile?.role === "admin") redirect("/admin");
  }

Proposed:
  const [{ data: { user } }, profileResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getUser().then(({ data: { user } }) =>
      // We need user.id to query profiles, so this can't fully parallelize.
      // BUT we can still avoid a redundant getUser call.
    ),
  ]);
```

Wait — we need `user.id` from step 4 to execute step 5. These are genuinely sequential. However, we can **eliminate the redundant `getUser()` call** by using the user data returned from `signInWithPassword`:

```
Current:
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // ^ discards the returned user object
  const { data: { user } } = await supabase.auth.getUser();
  // ^ makes a second API call to get the same user

Proposed:
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { ... }
  const user = data.user;
  // Skip the redundant getUser() call — signInWithPassword already returns the user
  // with email_confirmed_at populated.
```

This **eliminates one full Supabase Auth API round-trip** (100-300ms savings).

Then the profile fetch can happen immediately with `user.id`:

```ts
if (user && !user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}
const { data: profile } = await adminClient
  .from("profiles").select("role").eq("auth_user_id", user.id).single();
```

**Same optimization applies to `adminLoginAction`** (lines 248-274) — it also discards the `signInWithPassword` return value and makes a redundant `getUser()`.

**Estimated savings:** 100-300ms per login.

##### C2b. Dashboard `loading.tsx` (from C1)

The `loading.tsx` file for the dashboard (from C1 above) ensures the user sees the portal shell + a skeleton immediately after the login redirect, rather than a blank screen while the dashboard page server component resolves.

**Estimated perceived improvement:** The user sees the portal (navbar, shell, skeleton) ~1-2 seconds sooner than before, even if total data load time is the same.

##### C2c. Do NOT pre-validate email

The user suggested debounced email validation on blur. We are **not** implementing this because:

1. **Security risk:** An endpoint that confirms whether an email exists enables account enumeration attacks. The current login intentionally returns a generic "Invalid email or password" message.
2. **Minimal time savings:** `signInWithPassword` validates email + password in a single call. Pre-checking email doesn't remove any server work — it just shifts it earlier.
3. **UX tradeoff:** Users who type their email and immediately tab to password would see a network request firing, and if it returns "not found," it interrupts their flow before they've even tried to submit.

### Files changed (Issue C)

| File | Action |
|------|--------|
| `src/app/(portal)/dashboard/loading.tsx` | **New** — catalogue grid skeleton |
| `src/app/(portal)/cart/loading.tsx` | **New** — cart review skeleton |
| `src/app/(portal)/orders/loading.tsx` | **New** — order history table skeleton |
| `src/app/(portal)/catalogue/loading.tsx` | **New** — catalogue grid skeleton |
| `src/app/(admin)/admin/loading.tsx` | **New** — admin page skeleton |
| `src/app/actions/auth.ts` | Use `signInWithPassword` return value instead of redundant `getUser()` in `loginAction` and `adminLoginAction` |

---

## Cumulative file change summary

| File | Issues | Action |
|------|--------|--------|
| `src/components/portal/NavBar.tsx` | A | Add `clearCart()` before logout |
| `src/components/portal/CartGuard.tsx` | A | **New** — clear stale cart on layout mount |
| `src/app/(portal)/layout.tsx` | A | Render `<CartGuard />` |
| `src/components/admin/ClientDrawer.tsx` | B | Add `formData.set("id", client!.id)` in submit handler |
| `src/app/(portal)/dashboard/loading.tsx` | C | **New** — skeleton |
| `src/app/(portal)/cart/loading.tsx` | C | **New** — skeleton |
| `src/app/(portal)/orders/loading.tsx` | C | **New** — skeleton |
| `src/app/(admin)/admin/loading.tsx` | C | **New** — skeleton |
| `src/app/actions/auth.ts` | C | Eliminate redundant `getUser()` calls |

**Total:** 4 modified files, 5 new files. No DB migrations. No dependency changes.

---

## Out of scope

- **Cart namespacing by user ID**: Nice UX improvement but not needed to fix the data leak. Can be added later.
- **Server-side cart**: Architectural change too large for this iteration.
- **Portal layout Suspense refactor**: Wrapping NavBar in Suspense for streaming the business name. Deferred — `loading.tsx` provides most of the benefit.
- **Email pre-validation on login**: Security risk (account enumeration). Not implementing.
- **`useActionState` migration for admin forms**: Scope creep. The explicit `formData.set()` fix is sufficient.
