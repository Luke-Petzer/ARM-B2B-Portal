-- ============================================================
-- Migration: Per-client custom pricing (2026-04-30)
-- Adds client_custom_prices table and client_discount_pct
-- column on profiles for two-mechanism custom pricing.
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS and DO $$ guards.
-- ============================================================

-- 1. New table: client_custom_prices
CREATE TABLE IF NOT EXISTS public.client_custom_prices (
  id              UUID          NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price    NUMERIC(10,2) NOT NULL CHECK (custom_price >= 0),
  notes           TEXT,
  created_by      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, product_id)
);

-- 2. RLS policies
ALTER TABLE public.client_custom_prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_access' AND tablename = 'client_custom_prices') THEN
    CREATE POLICY admin_full_access ON client_custom_prices FOR ALL
      TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'buyer_read_own' AND tablename = 'client_custom_prices') THEN
    CREATE POLICY buyer_read_own ON client_custom_prices FOR SELECT
      TO authenticated USING (profile_id = auth.uid());
  END IF;
END
$$;

-- 3. Grant service_role full access (for adminClient usage)
GRANT ALL ON public.client_custom_prices TO service_role;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_custom_prices_updated_at ON public.client_custom_prices;
CREATE TRIGGER trg_client_custom_prices_updated_at
  BEFORE UPDATE ON public.client_custom_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Add client_discount_pct column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'client_discount_pct'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN client_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0
      CHECK (client_discount_pct >= 0 AND client_discount_pct <= 100);
  END IF;
END
$$;

COMMENT ON COLUMN public.profiles.client_discount_pct IS
  'Blanket percentage discount for this client. Applied to all products unless overridden by client_custom_prices.';

-- 6. Index for fast lookups by profile_id
CREATE INDEX IF NOT EXISTS idx_client_custom_prices_profile_id
  ON public.client_custom_prices (profile_id);
