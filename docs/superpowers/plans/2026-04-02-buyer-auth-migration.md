# Buyer Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate buyer authentication from account-number custom JWT to Supabase Auth email + password, add public landing and auth pages, make the catalogue public, and update admin client creation to use email invites.

**Architecture:** Buyers sign up via Supabase Auth — a new DB trigger mirrors the admin pattern and creates a `profiles` row with `id = auth.users.id`. A Supabase Custom Access Token Hook injects the `app_role` JWT claim so all existing RLS policies continue to work without modification. The existing custom buyer JWT path in `getSession()` remains active for any in-flight sessions (they expire in 24h).

**Tech Stack:** Next.js 16 App Router, Supabase Auth (`@supabase/ssr`), Supabase JS v2, Vitest, Zod, React Hook Form, Tailwind CSS, shadcn/ui components

---

## File Map

**New files:**
- `supabase/migrations/20260402_buyer_auth_migration.sql` — DB migration (ready-to-run in Supabase SQL Editor)
- `src/app/auth/callback/route.ts` — Supabase Auth callback handler (code exchange)
- `src/app/(auth)/register/page.tsx` — Self-registration page
- `src/app/(auth)/forgot-password/page.tsx` — Forgot password page
- `src/app/(auth)/reset-password/page.tsx` — Reset password page
- `src/app/actions/addresses.ts` — `saveAddressAction` server action
- `src/components/auth/AddressGateForm.tsx` — Inline address form shown at checkout if no addresses
- `tests/audit/auth/login-action.test.ts` — Tests for new login server action
- `tests/audit/auth/signup-action.test.ts` — Tests for signup server action
- `tests/audit/auth/session-isBuyer.test.ts` — Test for `getSession()` isBuyer fix

**Modified files:**
- `src/lib/auth/session.ts` — Fix `isBuyer` for Supabase Auth users
- `src/app/actions/auth.ts` — Replace `buyerLoginAction` with `loginAction`; add `signUpAction`, `forgotPasswordAction`, `resetPasswordAction`
- `src/app/(auth)/login/page.tsx` — Replace account-number field with email + password
- `src/app/page.tsx` — Landing page with dark theme and CTA buttons
- `src/app/(portal)/catalogue/page.tsx` — Remove auth guard
- `src/app/actions/checkout.ts` — Add address gate before order creation
- `src/app/actions/admin.ts` — Replace `createClientAction` with `inviteClientAction`
- `src/components/admin/ClientDrawer.tsx` — Update add-client form for email invite
- `src/components/portal/CartSidebar.tsx` — Handle `address_required` error from checkout

---

## Task 1: Database Migration SQL

**Files:**
- Create: `supabase/migrations/20260402_buyer_auth_migration.sql`

This is the foundational task. Run this SQL in the Supabase SQL Editor before any code changes.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260402_buyer_auth_migration.sql` with this content:

```sql
-- ============================================================
-- Migration: Buyer Auth Migration (2026-04-02)
-- Switches buyer authentication from account-number custom JWT
-- to Supabase Auth (email + password).
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS / DROP IF EXISTS guards.
--
-- After running this script:
--   1. Go to Supabase Dashboard → Authentication → Hooks
--   2. Under "Custom Access Token", select the function:
--      public.custom_access_token_hook
--   3. Save the hook.
-- ============================================================


-- ── 1. Relax buyer_requires_account_number constraint ────────
-- Allow buyers who authenticate via Supabase Auth (auth_user_id IS NOT NULL)
-- to have a NULL account_number.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS buyer_requires_account_number;

ALTER TABLE public.profiles
  ADD CONSTRAINT buyer_requires_account_number
    CHECK (
      role = 'admin'
      OR account_number IS NOT NULL
      OR auth_user_id IS NOT NULL
    );


-- ── 2. Make business_name nullable ───────────────────────────
-- Self-registered buyers may be individuals, not businesses.
-- Application code falls back to contact_name when business_name is NULL.

ALTER TABLE public.profiles
  ALTER COLUMN business_name DROP NOT NULL;


-- ── 3. Trigger: auto-create buyer profile on Supabase Auth signup ──
-- Mirrors handle_new_admin_user but for buyer_default accounts.
-- Fires when raw_user_meta_data.role != 'admin' (catches self-registration
-- and admin invites with role = 'buyer_default').

CREATE OR REPLACE FUNCTION public.handle_new_buyer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only handle non-admin signups
  IF NEW.raw_user_meta_data ->> 'role' = 'admin' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id,
    auth_user_id,
    role,
    business_name,
    contact_name,
    email,
    account_number,
    is_active
  ) VALUES (
    NEW.id,
    NEW.id,
    'buyer_default',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'business_name', '')), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'contact_name'), ''), 'New Client'),
    NEW.email,
    NULL,  -- no account number for Supabase Auth buyers
    true
  );

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists (safe re-run)
DROP TRIGGER IF EXISTS trg_on_buyer_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_buyer_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_buyer_user();


-- ── 4. Custom Access Token Hook ───────────────────────────────
-- Injects app_role into the Supabase Auth JWT so that the existing
-- get_app_role() SQL function and all RLS policies work unchanged
-- for Supabase Auth buyers.
--
-- Must be registered in the Supabase dashboard after running this script.
-- Dashboard → Authentication → Hooks → Custom Access Token
--   Function: public.custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims   jsonb;
  user_role text;
BEGIN
  -- Look up the user's role from profiles
  SELECT role::text INTO user_role
  FROM public.profiles
  WHERE auth_user_id = (event ->> 'user_id')::uuid;

  -- Build updated claims
  claims := event -> 'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute to supabase_auth_admin (required for the hook to fire)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Copy the contents of `supabase/migrations/20260402_buyer_auth_migration.sql` and run it in the Supabase SQL Editor.

Expected: No errors. Verify in Table Editor that:
- `profiles` table still has all existing rows
- The `buyer_requires_account_number` constraint is updated (check Database → Tables → profiles → Constraints)

- [ ] **Step 3: Register the Custom Access Token Hook in Supabase Dashboard**

1. Go to Supabase Dashboard → Authentication → Hooks
2. Under "Custom Access Token", enable it and select: `public.custom_access_token_hook`
3. Click Save

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260402_buyer_auth_migration.sql
git commit -m "feat(db): buyer auth migration — relax constraints, add buyer trigger, JWT hook"
```

---

## Task 2: Fix `getSession()` isBuyer for Supabase Auth Users

**Files:**
- Modify: `src/lib/auth/session.ts`
- Create: `tests/audit/auth/session-isBuyer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/audit/auth/session-isBuyer.test.ts`:

```typescript
// tests/audit/auth/session-isBuyer.test.ts
//
// Verifies getSession() correctly identifies Supabase Auth buyers
// (isBuyer = true) vs admins (isBuyer = false).

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks must be hoisted before imports ──────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function mockCookieStore(buyerCookie?: string) {
  return {
    get: vi.fn((name: string) => {
      if (name === "sb-buyer-session" && buyerCookie) {
        return { value: buyerCookie };
      }
      return undefined;
    }),
  } as any;
}

function mockSupabaseClient(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

function mockAdminClientProfile(profile: {
  id: string;
  role: string;
  account_number: string | null;
  admin_role: string | null;
}) {
  (adminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile }),
  });
}

describe("getSession: isBuyer for Supabase Auth users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SUPER_EMAIL = "";
  });

  it("sets isBuyer=true and isAdmin=false for a buyer_default Supabase Auth user", async () => {
    const cookieStore = mockCookieStore(); // no custom buyer cookie
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient({ id: "user-uuid-1", email: "buyer@example.com" })
    );
    mockAdminClientProfile({
      id: "user-uuid-1",
      role: "buyer_default",
      account_number: null,
      admin_role: null,
    });

    const session = await getSession(cookieStore);

    expect(session).not.toBeNull();
    expect(session!.isBuyer).toBe(true);
    expect(session!.isAdmin).toBe(false);
    expect(session!.role).toBe("buyer_default");
  });

  it("sets isBuyer=false and isAdmin=true for an admin Supabase Auth user", async () => {
    const cookieStore = mockCookieStore();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient({ id: "admin-uuid-1", email: "admin@example.com" })
    );
    mockAdminClientProfile({
      id: "admin-uuid-1",
      role: "admin",
      account_number: null,
      admin_role: "manager",
    });

    const session = await getSession(cookieStore);

    expect(session).not.toBeNull();
    expect(session!.isBuyer).toBe(false);
    expect(session!.isAdmin).toBe(true);
  });

  it("returns null when no cookie and no Supabase Auth user", async () => {
    const cookieStore = mockCookieStore();
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabaseClient(null)
    );

    const session = await getSession(cookieStore);

    expect(session).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npx vitest run tests/audit/auth/session-isBuyer.test.ts
```

Expected: FAIL — the `isBuyer` assertion fails because the current code hardcodes `isBuyer: false`.

- [ ] **Step 3: Fix `getSession()` in `src/lib/auth/session.ts`**

Find the Supabase Auth branch (step 2, around line 60) and change:

```typescript
// BEFORE
return {
  profileId: profile.id,
  role: profile.role,
  accountNumber: profile.account_number,
  isBuyer: false,
  isAdmin: profile.role === "admin",
  adminRole: profile.admin_role ?? "employee",
  isSuperAdmin: !!user.email && superEmails.includes(user.email),
  token: null,
};
```

To:

```typescript
// AFTER
return {
  profileId: profile.id,
  role: profile.role,
  accountNumber: profile.account_number,
  isBuyer: profile.role !== "admin",
  isAdmin: profile.role === "admin",
  adminRole: profile.admin_role ?? null,
  isSuperAdmin: !!user.email && superEmails.includes(user.email),
  token: null,
};
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx vitest run tests/audit/auth/session-isBuyer.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Run full test suite — verify no regressions**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/session.ts tests/audit/auth/session-isBuyer.test.ts
git commit -m "fix(auth): set isBuyer=true for Supabase Auth buyers in getSession"
```

---

## Task 3: Auth Callback Route Handler

**Files:**
- Create: `src/app/auth/callback/route.ts`

This route exchanges the Supabase Auth `code` param for a session cookie. Required for password reset emails and email confirmation links.

- [ ] **Step 1: Create `src/app/auth/callback/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): add Supabase Auth callback route handler"
```

---

## Task 4: New Auth Server Actions

**Files:**
- Modify: `src/app/actions/auth.ts`
- Create: `tests/audit/auth/login-action.test.ts`
- Create: `tests/audit/auth/signup-action.test.ts`

- [ ] **Step 1: Write failing tests for `loginAction`**

Create `tests/audit/auth/login-action.test.ts`:

```typescript
// tests/audit/auth/login-action.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { from: vi.fn() },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkLoginRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
}));

import { loginAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabaseWithSignIn(result: { error: { message: string } | null }) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue(result),
    },
  });
}

function makeFormData(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("loginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error for missing email", async () => {
    const fd = makeFormData("", "password123");
    const result = await loginAction(fd);
    expect(result?.error).toBeTruthy();
    expect(result?.error).toMatch(/email/i);
  });

  it("returns error for missing password", async () => {
    const fd = makeFormData("test@example.com", "");
    const result = await loginAction(fd);
    expect(result?.error).toBeTruthy();
  });

  it("returns error when Supabase Auth signIn fails", async () => {
    mockSupabaseWithSignIn({ error: { message: "Invalid login credentials" } });
    const fd = makeFormData("test@example.com", "wrongpassword");
    const result = await loginAction(fd);
    expect(result?.error).toBe("Invalid email or password.");
  });

  it("redirects on successful login", async () => {
    mockSupabaseWithSignIn({ error: null });
    const fd = makeFormData("test@example.com", "correctpassword");
    // redirect() throws REDIRECT error in tests (mocked in setup.ts)
    await expect(loginAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });
});
```

- [ ] **Step 2: Write failing tests for `signUpAction`**

Create `tests/audit/auth/signup-action.test.ts`:

```typescript
// tests/audit/auth/signup-action.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: { from: vi.fn() },
}));

import { signUpAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

function mockSupabaseWithSignUp(result: {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}) {
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: {
      signUp: vi.fn().mockResolvedValue(result),
    },
  });
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("signUpAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when contact name is missing", async () => {
    const fd = makeFormData({ contact_name: "", email: "a@b.com", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/contact name/i);
  });

  it("returns error when email is invalid", async () => {
    const fd = makeFormData({ contact_name: "John", email: "not-an-email", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/email/i);
  });

  it("returns error when password is too short", async () => {
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "short" });
    const result = await signUpAction(fd);
    expect(result?.error).toMatch(/password/i);
  });

  it("returns error when Supabase signUp fails", async () => {
    mockSupabaseWithSignUp({ data: { user: null }, error: { message: "Email already in use" } });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123" });
    const result = await signUpAction(fd);
    expect(result?.error).toBeTruthy();
  });

  it("redirects to dashboard on successful signup", async () => {
    mockSupabaseWithSignUp({ data: { user: { id: "new-uuid" } }, error: null });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123" });
    await expect(signUpAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("allows empty business name (individuals)", async () => {
    mockSupabaseWithSignUp({ data: { user: { id: "new-uuid" } }, error: null });
    const fd = makeFormData({ contact_name: "John", email: "a@b.com", password: "password123", business_name: "" });
    // Should not return a business name validation error
    await expect(signUpAction(fd)).rejects.toThrow("REDIRECT:/dashboard");
  });
});
```

- [ ] **Step 3: Run both tests — verify they fail**

```bash
npx vitest run tests/audit/auth/login-action.test.ts tests/audit/auth/signup-action.test.ts
```

Expected: FAIL — `loginAction` and `signUpAction` are not exported from `auth.ts` yet.

- [ ] **Step 4: Replace `buyerLoginAction` and add new actions in `src/app/actions/auth.ts`**

Replace the entire content of `src/app/actions/auth.ts` with:

```typescript
"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  BUYER_SESSION_COOKIE,
  buyerSessionCookieOptions,
} from "@/lib/auth/buyer";
import { checkLoginRateLimit } from "@/lib/rate-limit";

// ── Shared error response type ─────────────────────────────────────────────

export interface AuthActionResult {
  error: string | null;
}

// ── Validation schemas ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = z.object({
  contact_name: z.string().trim().min(1, "Contact name is required."),
  business_name: z.string().trim().optional(),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

// ── Buyer login (email + password via Supabase Auth) ──────────────────────

export async function loginAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  // Rate limit by IP
  const headerStore = await headers();
  const rawIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = rawIp && rawIp.length > 0 ? rawIp : `unknown:${email}`;
  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

// ── Self-registration ──────────────────────────────────────────────────────

export async function signUpAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    contact_name: formData.get("contact_name"),
    business_name: formData.get("business_name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { contact_name, business_name, email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "buyer_default",
        contact_name,
        business_name: business_name ?? "",
      },
    },
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Registration failed. Please try again." };
  }

  redirect("/dashboard");
}

// ── Forgot password ────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  // Always return success — don't reveal whether email exists
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reset-password`,
  });

  return { error: null };
}

// ── Reset password (after clicking email link) ─────────────────────────────

export async function resetPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Failed to update password. Please request a new reset link." };
  }

  redirect("/login");
}

// ── Admin login (unchanged) ────────────────────────────────────────────────

const adminLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function adminLoginAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Invalid email or password." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication failed." };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();

  // Clear buyer JWT cookie if present (legacy custom-JWT buyers)
  const buyerCookie = cookieStore.get(BUYER_SESSION_COOKIE);
  if (buyerCookie) {
    cookieStore.delete(BUYER_SESSION_COOKIE);
  }

  // Clear Supabase Auth session (Supabase Auth buyers + admins)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run tests/audit/auth/login-action.test.ts tests/audit/auth/signup-action.test.ts
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/auth.ts tests/audit/auth/login-action.test.ts tests/audit/auth/signup-action.test.ts
git commit -m "feat(auth): replace buyerLoginAction with Supabase Auth email+password actions"
```

---

## Task 5: Update Login Page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace `src/app/(auth)/login/page.tsx`**

```typescript
"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      const result = await loginAction(formData);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <AuthCard
      title="Welcome Back"
      description="Sign in to access your ordering portal."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Sign In
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat(auth): replace account-number login with email+password form"
```

---

## Task 6: Register Page

**Files:**
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create `src/app/(auth)/register/page.tsx`**

```typescript
"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { signUpAction } from "@/app/actions/auth";

const schema = z.object({
  contact_name: z.string().min(1, "Contact name is required"),
  business_name: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("contact_name", data.contact_name);
      formData.append("business_name", data.business_name ?? "");
      formData.append("email", data.email);
      formData.append("password", data.password);
      const result = await signUpAction(formData);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <AuthCard
      title="Create Account"
      description="Register to access the ordering portal."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input
            id="contact_name"
            placeholder="Your full name"
            autoComplete="name"
            {...register("contact_name")}
          />
          {errors.contact_name && (
            <p className="text-sm text-red-500">{errors.contact_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">
            Business Name{" "}
            <span className="text-muted-foreground font-normal text-xs">
              — optional
            </span>
          </Label>
          <Input
            id="business_name"
            placeholder="Leave blank if individual"
            autoComplete="organization"
            {...register("business_name")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/register/page.tsx
git commit -m "feat(auth): add self-registration page"
```

---

## Task 7: Forgot Password Page

**Files:**
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Create `src/app/(auth)/forgot-password/page.tsx`**

```typescript
"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      const result = await forgotPasswordAction(formData);
      if (result?.error) {
        setServerError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <AuthCard title="Check Your Email" description="">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot Password"
      description="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send Reset Link
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(auth)/forgot-password/page.tsx
git commit -m "feat(auth): add forgot password page"
```

---

## Task 8: Reset Password Page

**Files:**
- Create: `src/app/(auth)/reset-password/page.tsx`

Note: This page lives at `/auth/reset-password` because the callback route redirects to `/auth/reset-password`. Since it's under the `(auth)` group, it must be at `src/app/(auth)/reset-password/page.tsx` — but the URL will be `/reset-password`. The callback route uses `?next=/auth/reset-password`. **Important:** create the page at `src/app/auth/reset-password/page.tsx` (outside the auth group) so it matches the `/auth/reset-password` URL, OR update the callback route to use `?next=/reset-password` and put it inside the (auth) group.

Use the simpler approach: put inside `(auth)` group at `/reset-password` and update the callback redirect in Task 3 to `?next=/reset-password`.

- [ ] **Step 1: Update callback route to use `/reset-password` instead of `/auth/reset-password`**

In `src/app/auth/callback/route.ts`, the forgotPasswordAction already uses:
```
redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/reset-password`
```

And in `src/app/actions/auth.ts` the `forgotPasswordAction`, change the redirectTo:
```typescript
redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
```

- [ ] **Step 2: Create `src/app/(auth)/reset-password/page.tsx`**

```typescript
"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/app/actions/auth";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("password", data.password);
      const result = await resetPasswordAction(formData);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <AuthCard
      title="Set New Password"
      description="Enter and confirm your new password."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <Input
            id="confirm"
            type="password"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-sm text-red-500">{errors.confirm.message}</p>
          )}
        </div>

        {serverError && (
          <p className="text-sm text-red-500 text-center">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Update Password
        </Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 3: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/reset-password/page.tsx src/app/actions/auth.ts
git commit -m "feat(auth): add reset password page and fix callback redirect path"
```

---

## Task 9: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```typescript
import Link from "next/link";
import Image from "next/image";
import { adminClient } from "@/lib/supabase/admin";

export const revalidate = 3600; // revalidate branding every hour

export default async function LandingPage() {
  const { data: config } = await adminClient
    .from("tenant_config")
    .select("business_name, trading_name")
    .eq("id", 1)
    .single();

  const displayName = config?.trading_name ?? config?.business_name ?? "AR Steel";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Navbar */}
      <header className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="relative h-[52px] w-[115px]">
            <Image
              src="/logo.png"
              alt={displayName}
              fill
              className="object-contain"
              priority
            />
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/catalogue"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Catalogue
            </Link>
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-white/90 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-8">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl">
          {displayName}
        </h1>
        <p className="text-lg text-white/60 max-w-xl">
          Access our product catalogue and place orders online. Register for an
          account to get started.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/register"
            className="bg-white text-black px-6 py-3 rounded-md font-semibold hover:bg-white/90 transition-colors"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="border border-white/20 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/10 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <p className="text-sm text-white/40">
          Browse our{" "}
          <Link href="/catalogue" className="underline hover:text-white/70">
            product catalogue
          </Link>{" "}
          — no account required.
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): add dark-theme landing page with sign up/login CTAs"
```

---

## Task 10: Make Catalogue Public

**Files:**
- Modify: `src/app/(portal)/catalogue/page.tsx`

- [ ] **Step 1: Remove the auth guard from catalogue**

In `src/app/(portal)/catalogue/page.tsx`, remove these two lines:

```typescript
// DELETE these two lines:
const session = await getSession();
if (!session) redirect("/login");
```

Also remove the now-unused imports of `getSession` and `redirect`.

- [ ] **Step 2: Verify the file still compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(portal)/catalogue/page.tsx
git commit -m "feat(catalogue): make catalogue page publicly accessible (no login required)"
```

---

## Task 11: Pre-order Address Gate at Checkout

**Files:**
- Create: `src/app/actions/addresses.ts`
- Create: `src/components/auth/AddressGateForm.tsx`
- Modify: `src/app/actions/checkout.ts`
- Modify: `src/components/portal/CartSidebar.tsx`

- [ ] **Step 1: Create `src/app/actions/addresses.ts`**

```typescript
"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { adminClient } from "@/lib/supabase/admin";

const addressSchema = z.object({
  line1: z.string().trim().min(1, "Street address is required"),
  line2: z.string().trim().optional(),
  suburb: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  province: z.string().trim().optional(),
  postal_code: z.string().trim().optional(),
  country: z.string().trim().default("South Africa"),
});

export async function saveAddressAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  const session = await getSession();
  if (!session || !session.isBuyer) return { error: "Unauthorized" };

  const parsed = addressSchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    suburb: formData.get("suburb") || undefined,
    city: formData.get("city"),
    province: formData.get("province") || undefined,
    postal_code: formData.get("postal_code") || undefined,
    country: formData.get("country") || "South Africa",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await adminClient.from("addresses").insert({
    profile_id: session.profileId,
    type: "shipping",
    is_default: true,
    ...parsed.data,
  });

  if (error) return { error: "Failed to save address. Please try again." };
  return { success: true };
}
```

- [ ] **Step 2: Add address check to `checkoutAction` in `src/app/actions/checkout.ts`**

Find the `checkoutAction` function. After the session check and before the cart validation, add an address check. Find:

```typescript
export async function checkoutAction(
```

And after the existing `const session = await getSession();` check (around line 168), add:

```typescript
  // Check buyer has at least one shipping address
  if (session.isBuyer) {
    const { data: addresses } = await adminClient
      .from("addresses")
      .select("id")
      .eq("profile_id", session.profileId)
      .eq("type", "shipping")
      .limit(1);

    if (!addresses || addresses.length === 0) {
      return { error: "address_required" };
    }
  }
```

- [ ] **Step 3: Create `src/components/auth/AddressGateForm.tsx`**

```typescript
"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { saveAddressAction } from "@/app/actions/addresses";

const schema = z.object({
  line1: z.string().min(1, "Street address is required"),
  line2: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().min(1, "City is required"),
  province: z.string().optional(),
  postal_code: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AddressGateFormProps {
  onSaved: () => void;
}

export default function AddressGateForm({ onSaved }: AddressGateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v) fd.set(k, v); });
      const result = await saveAddressAction(fd);
      if ("error" in result) {
        setServerError(result.error);
      } else {
        onSaved();
      }
    });
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-amber-50 border-amber-200">
      <div className="flex items-center gap-2 text-amber-800">
        <MapPin className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">
          Please add a delivery address before placing your first order.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <Label htmlFor="line1" className="text-xs">Street Address *</Label>
          <Input id="line1" placeholder="123 Main Street" {...register("line1")} />
          {errors.line1 && <p className="text-xs text-red-500 mt-1">{errors.line1.message}</p>}
        </div>
        <div>
          <Label htmlFor="line2" className="text-xs">Unit / Building</Label>
          <Input id="line2" placeholder="Unit 4B (optional)" {...register("line2")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="suburb" className="text-xs">Suburb</Label>
            <Input id="suburb" placeholder="Sandton" {...register("suburb")} />
          </div>
          <div>
            <Label htmlFor="city" className="text-xs">City *</Label>
            <Input id="city" placeholder="Johannesburg" {...register("city")} />
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="province" className="text-xs">Province</Label>
            <Input id="province" placeholder="Gauteng" {...register("province")} />
          </div>
          <div>
            <Label htmlFor="postal_code" className="text-xs">Postal Code</Label>
            <Input id="postal_code" placeholder="2196" {...register("postal_code")} />
          </div>
        </div>

        {serverError && <p className="text-sm text-red-500">{serverError}</p>}

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
          Save Address & Continue
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Update `CartSidebar.tsx` to show AddressGateForm when `address_required` is returned**

Find where `checkoutAction` result is handled in `CartSidebar.tsx`. Add an `addressRequired` state. When `result?.error === "address_required"`, set `addressRequired = true` and render `<AddressGateForm>` instead of the error text.

Find the checkout submission in `CartSidebar.tsx` (look for the `checkoutAction` call) and update the handler:

```typescript
// Add import at top:
import AddressGateForm from "@/components/auth/AddressGateForm";

// Add state near top of component:
const [addressRequired, setAddressRequired] = useState(false);

// In the checkout result handler, replace or add:
if (result?.error === "address_required") {
  setAddressRequired(true);
  return;
}
```

And in the JSX, above the checkout button, add:

```tsx
{addressRequired && (
  <AddressGateForm onSaved={() => setAddressRequired(false)} />
)}
```

- [ ] **Step 5: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/addresses.ts src/components/auth/AddressGateForm.tsx src/app/actions/checkout.ts src/components/portal/CartSidebar.tsx
git commit -m "feat(checkout): add address gate — prompt for delivery address before first order"
```

---

## Task 12: Admin — Invite Client via Email

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/components/admin/ClientDrawer.tsx`

- [ ] **Step 1: Add `inviteClientAction` to `src/app/actions/admin.ts`**

Find and replace the `createClientAction` function in `src/app/actions/admin.ts` with:

```typescript
// ── inviteClientAction ─────────────────────────────────────────────────────
// Sends a Supabase Auth invite email to a new buyer.
// The handle_new_buyer_user trigger creates their profile automatically
// when they accept the invite and set their password.

export async function inviteClientAction(
  formData: FormData
): Promise<{ error: string } | { success: true }> {
  await requireAdmin();

  const email = (formData.get("email") as string)?.trim();
  const contactName = (formData.get("contact_name") as string)?.trim();
  const businessName = (formData.get("business_name") as string)?.trim() || undefined;

  if (!email || !contactName) {
    return { error: "Email and contact name are required." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "buyer_default",
      contact_name: contactName,
      business_name: businessName ?? "",
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

- [ ] **Step 2: Update `ClientDrawer.tsx` to use the invite flow for new clients**

In `src/components/admin/ClientDrawer.tsx`:

1. Add import: `import { inviteClientAction, updateClientAction } from "@/app/actions/admin";`  
   (Remove `createClientAction` from imports)

2. In the create form (when `!client`), replace the existing form fields with the invite form. The invite only needs: Email, Contact Name, Business Name (optional). The full profile details can be edited after the invite is sent.

Find the section that renders the create form fields and replace with:

```tsx
{/* Create mode: invite form */}
{!client && (
  <>
    <div>
      <FieldLabel>Email *</FieldLabel>
      <input
        name="email"
        type="email"
        required
        placeholder="client@company.com"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
    <div>
      <FieldLabel>Contact Name *</FieldLabel>
      <input
        name="contact_name"
        type="text"
        required
        placeholder="Full name"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
    <div>
      <FieldLabel>Business Name</FieldLabel>
      <input
        name="business_name"
        type="text"
        placeholder="Leave blank if individual"
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
    <p className="text-xs text-slate-500">
      An invitation email will be sent to the client. Their account is created
      when they accept and set a password.
    </p>
  </>
)}
```

3. Update the form submit handler. When creating (no `client`), call `inviteClientAction`:

```typescript
const result = client
  ? await updateClientAction(fd)
  : await inviteClientAction(fd);

if ("error" in result) {
  setError(result.error);
  return;
}

onSaved();
onClose();
```

- [ ] **Step 3: Verify it builds**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/admin.ts src/components/admin/ClientDrawer.tsx
git commit -m "feat(admin): replace create-client with email invite flow"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass with no failures.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Lint**

```bash
npx eslint src
```

Expected: No errors (warnings acceptable).

- [ ] **Step 4: Verify NEXT_PUBLIC_SITE_URL env var is set**

Check `.env.local` (or equivalent) contains:
```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

This is required for the forgot-password redirect URL in `forgotPasswordAction`. If not set, add it.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass — buyer auth migration complete"
```

---

## Post-Deployment Checklist (Manual)

After deploying to production:

1. **Run the DB migration SQL** in Supabase SQL Editor (`supabase/migrations/20260402_buyer_auth_migration.sql`)
2. **Register the JWT Hook** in Supabase Dashboard → Auth → Hooks → Custom Access Token → `public.custom_access_token_hook`
3. **Set `NEXT_PUBLIC_SITE_URL`** in Vercel/hosting env vars to your production domain
4. **Test self-registration:** Register a new account, confirm profile is created in Supabase, confirm redirect to dashboard works
5. **Test admin invite:** Send invite from admin panel, confirm email arrives, accept invite and set password, confirm login works
6. **Test forgot password:** Request reset, click link, set new password, confirm login with new password
7. **Verify catalogue is public:** Open an incognito window and navigate to `/catalogue` — confirm it loads without login
