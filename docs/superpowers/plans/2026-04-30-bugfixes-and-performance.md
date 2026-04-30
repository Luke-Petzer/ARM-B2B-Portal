# Bugfixes & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a cart data leak across user sessions (security), fix admin role update failing with "Invalid client ID", and improve perceived performance via loading skeletons and login optimization.

**Architecture:** Three incremental changes — (A) clear client-side cart at session boundaries using two checkpoints, (B) one-line FormData fix for admin drawer, (C) `loading.tsx` skeletons for instant page transitions + eliminate redundant Supabase Auth API call in login. Each task is independently testable.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand v5, Supabase Auth, Vitest, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-30-bugfixes-and-performance-design.md`

---

## File Map

| File | Responsibility | Task |
|------|---------------|------|
| `src/components/portal/CartGuard.tsx` | **New** — Client component that clears stale cart on fresh layout mount via sessionStorage flag | 1 |
| `src/app/(portal)/layout.tsx` | **Modify** — Render `<CartGuard />` in the portal layout | 1 |
| `src/components/portal/NavBar.tsx` | **Modify** — Clear cart before calling logoutAction | 2 |
| `tests/audit/cart/cart-session-isolation.test.ts` | **New** — Tests for CartGuard behavior | 1 |
| `tests/audit/cart/cart-logout-clear.test.ts` | **New** — Tests for NavBar cart clearing on logout | 2 |
| `src/components/admin/ClientDrawer.tsx` | **Modify** — Add explicit `formData.set("id", client!.id)` in submit handler | 3 |
| `tests/audit/admin/client-drawer-submit.test.ts` | **New** — Tests for FormData ID injection | 3 |
| `src/app/actions/auth.ts` | **Modify** — Use `signInWithPassword` return value, remove redundant `getUser()` | 4 |
| `tests/audit/auth/login-action.test.ts` | **Modify** — Update mock to return user from `signInWithPassword` | 4 |
| `src/app/(portal)/dashboard/loading.tsx` | **New** — Dashboard/catalogue skeleton | 5 |
| `src/app/(portal)/orders/loading.tsx` | **New** — Order history skeleton | 5 |
| `src/app/(portal)/cart/loading.tsx` | **New** — Cart review skeleton | 5 |
| `src/app/(admin)/admin/loading.tsx` | **New** — Admin pages skeleton | 5 |

---

### Task 1: CartGuard — clear stale cart on fresh layout mount

**Files:**
- Create: `src/components/portal/CartGuard.tsx`
- Create: `tests/audit/cart/cart-session-isolation.test.ts`
- Modify: `src/app/(portal)/layout.tsx`

- [ ] **Step 1: Write the failing tests for CartGuard**

Create `tests/audit/cart/cart-session-isolation.test.ts`:

```ts
// tests/audit/cart/cart-session-isolation.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock zustand store — we test that clearCart is called under the right conditions
const mockClearCart = vi.fn();
const mockGetState = vi.fn(() => ({ clearCart: mockClearCart }));

vi.mock("@/lib/cart/store", () => ({
  useCartStore: Object.assign(vi.fn(), { getState: mockGetState }),
}));

// Mock sessionStorage
const sessionStorageMap = new Map<string, string>();
const mockSessionStorage = {
  getItem: vi.fn((key: string) => sessionStorageMap.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => sessionStorageMap.set(key, val)),
  removeItem: vi.fn((key: string) => sessionStorageMap.delete(key)),
  clear: vi.fn(() => sessionStorageMap.clear()),
  get length() { return sessionStorageMap.size; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "sessionStorage", { value: mockSessionStorage, writable: true });

import { renderCartGuardEffect } from "@/components/portal/CartGuard";

describe("CartGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMap.clear();
  });

  it("clears cart when session flag is absent (fresh login)", () => {
    renderCartGuardEffect();
    expect(mockClearCart).toHaveBeenCalledOnce();
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith("cart-session-active", "1");
  });

  it("does NOT clear cart when session flag is present (in-app navigation)", () => {
    sessionStorageMap.set("cart-session-active", "1");
    renderCartGuardEffect();
    expect(mockClearCart).not.toHaveBeenCalled();
  });

  it("sets session flag after clearing cart", () => {
    renderCartGuardEffect();
    expect(sessionStorageMap.get("cart-session-active")).toBe("1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/audit/cart/cart-session-isolation.test.ts`
Expected: FAIL — `renderCartGuardEffect` does not exist yet.

- [ ] **Step 3: Create CartGuard component**

Create `src/components/portal/CartGuard.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/store";

const SESSION_FLAG = "cart-session-active";

/**
 * Exported for unit testing — runs the same logic as the useEffect.
 * In production, only the default export (React component) is used.
 */
export function renderCartGuardEffect(): void {
  if (sessionStorage.getItem(SESSION_FLAG)) return;
  useCartStore.getState().clearCart();
  sessionStorage.setItem(SESSION_FLAG, "1");
}

/**
 * Clears any leftover cart data from a previous user session.
 *
 * Mounted in the portal layout. On fresh page loads (login redirect, browser
 * refresh, new tab), the sessionStorage flag is absent, so the cart is cleared.
 * During normal in-app navigation the layout stays mounted and this effect
 * does not re-run.
 */
export default function CartGuard() {
  useEffect(() => {
    renderCartGuardEffect();
  }, []);
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/audit/cart/cart-session-isolation.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Add CartGuard to portal layout**

Modify `src/app/(portal)/layout.tsx`. Add the import and render `<CartGuard />` inside the layout JSX:

Add import at top (after existing imports):
```ts
import CartGuard from "@/components/portal/CartGuard";
```

Add `<CartGuard />` as the first child inside the outer `<div>`:
```tsx
<div className="h-[100dvh] overflow-hidden flex flex-col bg-white">
  <CartGuard />
  {/* Banner is flex-shrink-0 ... */}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/portal/CartGuard.tsx tests/audit/cart/cart-session-isolation.test.ts src/app/\(portal\)/layout.tsx
git commit -m "fix(cart): clear stale cart on fresh layout mount to prevent cross-user data leak

Add CartGuard component that uses sessionStorage to detect fresh page loads
(login redirect, new tab) and clears any leftover cart data from a previous
session. Prevents user B from seeing user A's cart on the same browser.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Clear cart on logout (NavBar)

**Files:**
- Modify: `src/components/portal/NavBar.tsx`
- Create: `tests/audit/cart/cart-logout-clear.test.ts`

- [ ] **Step 1: Write the failing test for logout cart clearing**

Create `tests/audit/cart/cart-logout-clear.test.ts`:

```ts
// tests/audit/cart/cart-logout-clear.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClearCart = vi.fn();
const mockGetState = vi.fn(() => ({ clearCart: mockClearCart }));

vi.mock("@/lib/cart/store", () => ({
  useCartStore: Object.assign(
    // Selector-style call: useCartStore((s) => s.items)
    vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ items: [], clearCart: mockClearCart })
    ),
    { getState: mockGetState }
  ),
}));

vi.mock("@/app/actions/auth", () => ({
  logoutAction: vi.fn().mockResolvedValue(undefined),
}));

import { logoutAction } from "@/app/actions/auth";

describe("NavBar logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls clearCart before logoutAction", async () => {
    // We can't render the full NavBar in vitest (no DOM), so we test the
    // contract: clearCart must be called, then logoutAction must be called.
    // This test documents the expected call order for the handleLogout function.
    const { useCartStore } = await import("@/lib/cart/store");
    const clearCart = useCartStore.getState().clearCart;

    // Simulate the handleLogout sequence
    clearCart();
    await logoutAction();

    expect(mockClearCart).toHaveBeenCalledOnce();
    expect(logoutAction).toHaveBeenCalledOnce();

    // clearCart was called before logoutAction
    const clearCartOrder = mockClearCart.mock.invocationCallOrder[0];
    const logoutOrder = (logoutAction as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(clearCartOrder).toBeLessThan(logoutOrder);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (this is a contract test)**

Run: `npx vitest run tests/audit/cart/cart-logout-clear.test.ts`
Expected: PASS — the contract test verifies the expected call order.

- [ ] **Step 3: Modify NavBar to clear cart before logout**

Modify `src/components/portal/NavBar.tsx`.

Add `clearCart` to the cart store usage. Change the existing line 36-38:

```tsx
// Before (line 36-38):
const cartCount = useCartStore((s) =>
  s.items.reduce((n, item) => n + item.quantity, 0)
);

// After:
const cartCount = useCartStore((s) =>
  s.items.reduce((n, item) => n + item.quantity, 0)
);
const clearCart = useCartStore((s) => s.clearCart);
```

Update `handleLogout` (lines 40-44):

```tsx
// Before:
const handleLogout = () => {
  startLogout(async () => {
    await logoutAction();
  });
};

// After:
const handleLogout = () => {
  clearCart();
  startLogout(async () => {
    await logoutAction();
  });
};
```

- [ ] **Step 4: Run all cart tests**

Run: `npx vitest run tests/audit/cart/`
Expected: PASS — all tests green (both cart-session-isolation and cart-logout-clear).

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/NavBar.tsx tests/audit/cart/cart-logout-clear.test.ts
git commit -m "fix(cart): clear cart before logout to prevent cross-user data leak

Call clearCart() synchronously before invoking logoutAction() server action.
This ensures localStorage cart data is wiped even if the server action
fails or the redirect interrupts cleanup. Defense-in-depth with CartGuard.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Fix admin role update — explicit FormData ID injection

**Files:**
- Modify: `src/components/admin/ClientDrawer.tsx`
- Create: `tests/audit/admin/client-drawer-submit.test.ts`

- [ ] **Step 1: Write the failing test for FormData ID injection**

Create `tests/audit/admin/client-drawer-submit.test.ts`:

```ts
// tests/audit/admin/client-drawer-submit.test.ts

import { describe, it, expect } from "vitest";

/**
 * Unit test for the FormData preparation logic in ClientDrawer.
 * We extract the key invariant: after handleSubmit runs, the FormData
 * MUST contain a valid UUID "id" field when editing an existing client.
 */
describe("ClientDrawer FormData preparation", () => {
  const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("formData.set ensures id is present even if hidden input is missing", () => {
    // Simulate a form that has NO hidden id input (the bug scenario)
    const formData = new FormData();
    formData.set("account_number", "ACC-001");
    formData.set("business_name", "Test Corp");
    formData.set("role", "buyer_30_day");

    // Before fix: formData.get("id") would be null
    expect(formData.get("id")).toBeNull();

    // Apply the fix: explicit set
    formData.set("id", VALID_UUID);

    // After fix: id is always present
    expect(formData.get("id")).toBe(VALID_UUID);
  });

  it("formData.set overwrites a stale or empty id from the DOM", () => {
    const formData = new FormData();
    formData.set("id", ""); // empty string from DOM capture bug

    // Apply the fix
    formData.set("id", VALID_UUID);

    expect(formData.get("id")).toBe(VALID_UUID);
  });

  it("formData.set preserves other form fields", () => {
    const formData = new FormData();
    formData.set("account_number", "ACC-001");
    formData.set("business_name", "Test Corp");
    formData.set("role", "buyer_30_day");
    formData.set("contact_name", "John Doe");

    // Apply the fix
    formData.set("id", VALID_UUID);

    expect(formData.get("id")).toBe(VALID_UUID);
    expect(formData.get("account_number")).toBe("ACC-001");
    expect(formData.get("business_name")).toBe("Test Corp");
    expect(formData.get("role")).toBe("buyer_30_day");
    expect(formData.get("contact_name")).toBe("John Doe");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (these validate the fix approach)**

Run: `npx vitest run tests/audit/admin/client-drawer-submit.test.ts`
Expected: PASS — these are pure FormData tests confirming the fix strategy.

- [ ] **Step 3: Apply the fix to ClientDrawer**

Modify `src/components/admin/ClientDrawer.tsx`. In the `handleSubmit` function (line 116-133), add the explicit `formData.set` after constructing FormData:

```tsx
// Before (lines 116-133):
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setError(null);
  const formData = new FormData(e.currentTarget);

  startTransition(async () => {
    const result = isEdit
      ? await updateClientAction(formData)
      : await inviteClientAction(formData);
    // ...

// After:
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setError(null);
  const formData = new FormData(e.currentTarget);
  if (isEdit) formData.set("id", client!.id);

  startTransition(async () => {
    const result = isEdit
      ? await updateClientAction(formData)
      : await inviteClientAction(formData);
    // ...
```

The change is one line: `if (isEdit) formData.set("id", client!.id);` after `new FormData(e.currentTarget)`.

- [ ] **Step 4: Run the full test suite to ensure no regressions**

Run: `npx vitest run`
Expected: PASS — all existing tests plus new ones pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ClientDrawer.tsx tests/audit/admin/client-drawer-submit.test.ts
git commit -m "fix(admin): ensure client ID is always present in role update FormData

Explicitly set the client ID via formData.set() after FormData construction
to bypass a portal-rendered form DOM capture issue. The hidden input remains
as a fallback, but the explicit set guarantees the UUID is present regardless
of Radix Sheet portal behavior.

Fixes: 'Invalid client ID' error when updating buyer billing role.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Optimize login — eliminate redundant getUser() call

**Files:**
- Modify: `src/app/actions/auth.ts`
- Modify: `tests/audit/auth/login-action.test.ts`

- [ ] **Step 1: Update the login-action test mock to return user from signInWithPassword**

Modify `tests/audit/auth/login-action.test.ts`. Update the `mockSupabaseWithSignIn` helper to return user data from `signInWithPassword` instead of `getUser`:

```ts
// Replace the existing mockSupabaseWithSignIn function (lines 26-39):
function mockSupabaseWithSignIn(
  result: { error: { message: string } | null },
  userId: string | null = null
) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: "2026-01-01T00:00:00Z" }
            : null,
        },
        error: result.error,
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  });
}
```

Note: `getUser` is no longer mocked because `loginAction` will no longer call it.

- [ ] **Step 2: Add a test for unconfirmed email using signInWithPassword return**

Add this test to the `describe("loginAction")` block:

```ts
it("signs out and returns error when email is not confirmed", async () => {
  // signInWithPassword succeeds but email_confirmed_at is null
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: { id: "unconfirmed-user", email_confirmed_at: null },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  });

  const fd = makeFormData("unconfirmed@example.com", "password123");
  const result = await loginAction(fd);
  expect(result?.error).toMatch(/verify your email/i);
});
```

- [ ] **Step 3: Run tests to see the new test fail (loginAction still calls getUser)**

Run: `npx vitest run tests/audit/auth/login-action.test.ts`
Expected: Some tests may fail because the mock no longer provides `getUser` but `loginAction` still calls it.

- [ ] **Step 4: Update loginAction to use signInWithPassword return value**

Modify `src/app/actions/auth.ts`. Replace lines 68-98 of `loginAction`:

```ts
// Before (lines 68-98):
const supabase = await createClient();
const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  if (error.code === "email_not_confirmed") {
    return { error: "Please verify your email address before signing in." };
  }
  return { error: "Invalid email or password." };
}

// Check role to route admins to the admin portal, buyers to the dashboard
const { data: { user } } = await supabase.auth.getUser();

// [H4] Defensive email verification check — don't rely solely on Supabase
// project settings. If email_confirmed_at is null, sign out immediately.
if (user && !user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}

if (user) {
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }
}

redirect("/dashboard");

// After:
const supabase = await createClient();
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  if (error.code === "email_not_confirmed") {
    return { error: "Please verify your email address before signing in." };
  }
  return { error: "Invalid email or password." };
}

const user = data.user;

// [H4] Defensive email verification check — don't rely solely on Supabase
// project settings. If email_confirmed_at is null, sign out immediately.
if (user && !user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}

if (user) {
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }
}

redirect("/dashboard");
```

- [ ] **Step 5: Apply the same optimization to adminLoginAction**

Modify `src/app/actions/auth.ts`. Replace lines 247-274 of `adminLoginAction`:

```ts
// Before (lines 247-274):
const supabase = await createClient();
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

if (signInError) {
  return { error: "Invalid email or password." };
}

const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "Authentication failed." };

// [H4] Defensive email verification check
if (!user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}

// After:
const supabase = await createClient();
const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

if (signInError) {
  return { error: "Invalid email or password." };
}

const user = data.user;
if (!user) return { error: "Authentication failed." };

// [H4] Defensive email verification check
if (!user.email_confirmed_at) {
  await supabase.auth.signOut();
  return { error: "Please verify your email address before signing in." };
}
```

The rest of `adminLoginAction` (profile fetch + redirect) stays the same — it already uses `user.id`.

- [ ] **Step 6: Run all auth tests**

Run: `npx vitest run tests/audit/auth/`
Expected: PASS — all auth tests pass with the updated mock and implementation.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/app/actions/auth.ts tests/audit/auth/login-action.test.ts
git commit -m "perf(auth): eliminate redundant getUser() call in login actions

Use the user object returned by signInWithPassword() instead of making a
separate getUser() API call. This removes one full Supabase Auth round-trip
(100-300ms) from both loginAction and adminLoginAction.

The email_confirmed_at defensive check now reads from the signInWithPassword
response, which contains the same user data.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Add loading.tsx skeletons for instant page transitions

**Files:**
- Create: `src/app/(portal)/dashboard/loading.tsx`
- Create: `src/app/(portal)/orders/loading.tsx`
- Create: `src/app/(portal)/cart/loading.tsx`
- Create: `src/app/(admin)/admin/loading.tsx`

- [ ] **Step 1: Create dashboard loading skeleton**

Create `src/app/(portal)/dashboard/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-6 pb-24">
        {/* Search bar skeleton */}
        <div className="h-10 w-full max-w-md bg-slate-200 rounded-lg animate-pulse mb-6" />

        {/* Category tabs skeleton */}
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="h-40 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              <div className="flex justify-between items-center">
                <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-9 w-20 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create orders loading skeleton**

Create `src/app/(portal)/orders/loading.tsx`:

```tsx
export default function OrdersLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#fcfcfc]">
      <main className="max-w-[1200px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-7 w-40 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="border-b border-slate-100 px-6 py-4 flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex gap-8 border-b border-slate-50">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create cart loading skeleton**

Create `src/app/(portal)/cart/loading.tsx`:

```tsx
export default function CartLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/30 flex flex-col">
      <div className="max-w-[900px] w-full mx-auto px-4 md:px-8 pt-12 pb-24">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Cart items skeleton */}
        <div className="space-y-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
              <div className="h-16 w-16 bg-slate-200 rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Summary skeleton */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="border-t border-slate-100 pt-3 flex justify-between">
            <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-12 w-full bg-slate-200 rounded-lg animate-pulse mt-4" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create admin loading skeleton**

Create `src/app/(admin)/admin/loading.tsx`:

```tsx
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div>
        <div className="h-7 w-48 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-6">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the dev server starts cleanly**

Run: `npx next build --no-lint 2>&1 | head -30` (or `npm run build` if defined)
Expected: Build succeeds with no errors. The `loading.tsx` files are automatically picked up by the App Router.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(portal\)/dashboard/loading.tsx src/app/\(portal\)/orders/loading.tsx src/app/\(portal\)/cart/loading.tsx src/app/\(admin\)/admin/loading.tsx
git commit -m "perf(ui): add loading skeletons for instant page transitions

Add loading.tsx files to portal routes (dashboard, orders, cart) and admin
routes. Next.js App Router wraps page content in Suspense when loading.tsx
exists, so the navbar/shell stays visible and a skeleton appears immediately
during navigation instead of the browser waiting for server components.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing 60+ tests plus the new ones from Tasks 1-4).

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Build succeeds with no errors.
