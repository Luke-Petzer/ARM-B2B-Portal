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
  )
  ON CONFLICT (id) DO NOTHING;

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
