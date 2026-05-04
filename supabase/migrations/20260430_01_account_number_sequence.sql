-- ============================================================
-- Migration: Auto-generated account numbers (2026-04-30)
-- Creates a PostgreSQL sequence and updates the buyer signup
-- trigger to auto-assign ARM-NNNNNN format account numbers.
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS and CREATE OR REPLACE.
-- ============================================================

-- 1. Create sequence for account numbers
CREATE SEQUENCE IF NOT EXISTS public.account_number_seq START 1;

-- 2. Update the trigger to auto-assign account numbers
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
    'ARM-' || LPAD(nextval('account_number_seq')::text, 6, '0'),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Backfill existing NULL account numbers for Auth-registered buyers
UPDATE profiles
SET account_number = 'ARM-' || LPAD(nextval('account_number_seq')::text, 6, '0')
WHERE account_number IS NULL AND auth_user_id IS NOT NULL;
