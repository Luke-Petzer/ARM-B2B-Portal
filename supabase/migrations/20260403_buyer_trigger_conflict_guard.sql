-- ============================================================
-- Hotfix: Add ON CONFLICT guard to handle_new_buyer_user
-- Applied: 2026-04-03
-- Run in Supabase SQL Editor to patch the live function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_buyer_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    NULL,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
