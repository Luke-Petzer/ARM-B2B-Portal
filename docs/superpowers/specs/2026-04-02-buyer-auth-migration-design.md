# Design Spec: Buyer Auth Migration & Landing Page
**Date:** 2026-04-02  
**Branch:** system-simplified  
**Status:** Approved

---

## Overview

This spec covers three interconnected areas:
1. Migrating buyer authentication from account-number custom JWT to Supabase Auth (email + password)
2. Adding public-facing landing and auth pages (login, register, forgot password, reset password)
3. Making the catalogue page publicly accessible while keeping the order sheet gated

Self-registered clients are always EFT (`buyer_default`) and follow the existing EFT checkout flow unchanged. Admins invite clients via email instead of creating account numbers.

---

## 1. Database Migration

**File:** `supabase/migrations/20260402_buyer_auth_migration.sql`

### 1.1 Constraint Changes on `profiles`

**`buyer_requires_account_number`** — relaxed to allow Supabase Auth buyers (who have no account number):
```sql
CHECK (role = 'admin' OR account_number IS NOT NULL OR auth_user_id IS NOT NULL)
```

**`business_name`** — changed from `NOT NULL` to nullable. All app code that displays business name falls back to `contact_name` when null.

### 1.2 New Trigger: `handle_new_buyer_user`

Fires `AFTER INSERT ON auth.users` when `raw_user_meta_data ->> 'role' != 'admin'` (companion to the existing `handle_new_admin_user` trigger).

Creates a `profiles` row:
- `id = NEW.id` (same as auth.users.id — mirrors admin pattern so `auth.uid() = profiles.id`)
- `auth_user_id = NEW.id`
- `role = 'buyer_default'`
- `contact_name` from metadata (required)
- `business_name` from metadata (optional, may be NULL)
- `email = NEW.email`
- `account_number = NULL`
- `is_active = true`

### 1.3 Supabase Custom Access Token Hook

A new SQL function `custom_access_token_hook(event jsonb)` is registered as a Supabase Auth Hook (Auth > Hooks > Custom Access Token in the Supabase dashboard).

The function looks up the user's `role` from `profiles` where `auth_user_id = (event->>'user_id')::uuid` and injects it as `app_role` in the JWT claims. This keeps the existing `get_app_role()` RLS function working identically for Supabase Auth buyers.

**Admin note:** After running the migration SQL, register the hook in the Supabase dashboard manually.

### 1.4 SQL Script for Admin to Run

The full migration (constraints + trigger + hook function) is delivered as a single ready-to-run SQL script. No manual steps beyond running the script and registering the hook in the dashboard.

---

## 2. Session Handling

**File:** `src/lib/auth/session.ts`

One change: in the Supabase Auth branch (step 2), `isBuyer` is derived from `profile.role !== 'admin'` instead of being hardcoded to `false`. All other logic is unchanged.

The custom buyer JWT path (step 1) stays intact — existing sessions expire naturally (24h TTL) without forcing any logged-in buyer to re-authenticate.

---

## 3. Auth Pages

All auth pages reuse the existing `AuthCard` component and styling.

### 3.1 `/login` — Replace account number with email + password

- Fields: Email, Password
- "Forgot password?" link → `/forgot-password`
- "Don't have an account? Sign up" link → `/register`
- Server action: `supabase.auth.signInWithPassword({email, password})`
- On success: redirect to `/dashboard`
- On failure: show inline error

### 3.2 `/register` — New self-registration page

- Fields:
  - Contact Name (required)
  - Business Name (optional — placeholder: "Leave blank if individual")
  - Email (required)
  - Password (required, min 8 chars)
- Server action: `supabase.auth.signUp({email, password, options: {data: {role: 'buyer_default', contact_name, business_name}}})`
- Trigger auto-creates profile on Supabase side
- On success: redirect to `/dashboard` (immediate access, no admin approval)
- "Already have an account? Log in" link → `/login`

### 3.3 `/forgot-password` — Request password reset

- Field: Email
- Server action: `supabase.auth.resetPasswordForEmail(email, {redirectTo: '/auth/reset-password'})`
- Shows success message after submit regardless of whether email exists (security: don't leak account existence)
- "Back to login" link

### 3.4 `/auth/callback` — Auth callback route handler

- New `src/app/auth/callback/route.ts`
- Standard Supabase SSR pattern: exchanges `code` URL param for a session cookie
- Redirects to `/auth/reset-password` for password reset flows, `/dashboard` for others

### 3.5 `/auth/reset-password` — Set new password

- Fields: New Password, Confirm Password
- Requires active session (user arrived via reset email link → callback set session)
- Server action: `supabase.auth.updateUser({password})`
- On success: redirect to `/login` with success message

---

## 4. Landing Page

**File:** `src/app/page.tsx`

- Dark background to match the industrial design direction
- Reuses existing `NavBar` component with a `publicMode` prop (hides logout button, shows Login/Sign Up links)
- Hero section: business name/tagline (can be hardcoded or pulled from `tenant_config`)
- Two CTA buttons: "Sign Up" → `/register`, "Log In" → `/login`
- Catalogue nav link remains visible and publicly accessible
- Client handles remaining marketing content themselves

---

## 5. Catalogue — Now Public

**File:** `src/app/(portal)/catalogue/page.tsx`

Remove the `if (!session) redirect('/login')` guard. Data is already fetched via `adminClient` (service role), so no auth is needed for the data fetch. Unauthenticated visitors can view the catalogue freely.

---

## 6. Pre-order Address Gate

Handled at checkout, not as a separate onboarding page. When a buyer reaches checkout with no saved addresses, the checkout flow renders an inline address collection form as step 0 before payment. After the address is saved to the `addresses` table, checkout continues normally.

This keeps the UX within the natural order flow and avoids an extra route.

---

## 7. Admin — Client Creation via Email Invite

**File:** `src/app/(admin)/admin/clients/` (existing add-client form)

Change from account number + manual profile creation to email-based invite:

- Admin fills in: Email (required), Contact Name (required), Business Name (optional)
- Additional fields available after profile is created: phone, notes, credit limit, payment terms override
- Server action calls `supabase.auth.admin.inviteUserByEmail(email, {data: {role: 'buyer_default', contact_name, business_name}})`
- Supabase sends the client an invite email with a link to set their password
- `handle_new_buyer_user` trigger creates the profile automatically when they accept

Admin can edit the full profile (phone, notes, credit limit, etc.) via the existing client detail page after the invite is sent.

---

## 8. Existing Buyers — Backward Compatibility

Existing buyers with account numbers are not broken by this migration:
- The `buyer_requires_account_number` constraint is relaxed (not removed) — existing rows with account numbers are still valid
- The custom JWT cookie path in `getSession()` stays active
- Existing sessions expire naturally (24h TTL)
- To migrate an existing buyer to email+password: admin uses the new invite flow with their email address. The trigger creates a new profile linked to their auth user. Admin then updates the new profile with their business details, or we add a merge step later.

---

## 9. What Is NOT Changing

- EFT checkout flow — self-registered buyers are `buyer_default` and follow the identical path as existing EFT clients
- Order sheet auth guard — stays gated, login required
- Admin auth (email + password via Supabase Auth) — unchanged
- All RLS policies — unchanged (JWT hook makes `get_app_role()` work for new buyers)
- `buyer_sessions` table — kept, existing rows valid, no new rows written for Supabase Auth buyers
- Portal UI (order sheet, cart, checkout, orders) — unchanged, light theme stays
- All existing admin functionality — unchanged except client creation form

---

## Out of Scope

- Migrating existing account-number buyers in bulk to Supabase Auth (manual per-client via invite)
- Email verification enforcement at signup (Supabase default behaviour — can be enabled in dashboard)
- Dark theme on internal portal pages (deferred to future upgrade)
- Business name / VAT number collection at signup (collected post-registration at checkout)
