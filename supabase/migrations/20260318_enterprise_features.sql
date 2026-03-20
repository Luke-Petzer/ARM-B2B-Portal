-- ============================================================
-- Migration: Enterprise Features (2026-03-18)
-- Feature 1: available_credit column on profiles
-- Feature 2: Discount columns on products
-- Feature 3: global_settings table for notification banner
-- Run in Supabase SQL Editor → New Query → Run
-- SAFE TO RE-RUN: uses IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- ── Feature 1: available_credit on profiles ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_credit NUMERIC(12,2)
    CHECK (available_credit IS NULL OR available_credit >= 0);

COMMENT ON COLUMN public.profiles.available_credit IS
  'Current credit balance available to this buyer. NULL = no limit tracked. Manually adjusted by admins.';

-- ── Feature 2: Bulk discount columns on products ─────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_type TEXT
    CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_threshold INT
    CHECK (discount_threshold IS NULL OR discount_threshold > 0),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2)
    CHECK (discount_value IS NULL OR discount_value >= 0);

COMMENT ON COLUMN public.products.discount_type IS
  'Discount calculation method: ''percentage'' or ''fixed''. NULL = no bulk discount.';
COMMENT ON COLUMN public.products.discount_threshold IS
  'Minimum quantity required to trigger the bulk discount.';
COMMENT ON COLUMN public.products.discount_value IS
  'Discount amount: percentage points (0–100) or fixed ZAR deduction per unit, depending on discount_type.';

-- ── Feature 3: global_settings table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.global_settings (
  id               INT         PRIMARY KEY DEFAULT 1,
  banner_message   TEXT,
  is_banner_active BOOLEAN     NOT NULL DEFAULT false,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT global_settings_singleton CHECK (id = 1)
);

COMMENT ON TABLE public.global_settings IS
  'Singleton config row (id always = 1). Stores portal-wide notification banner state.';

-- Seed the singleton row
INSERT INTO public.global_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_global_settings" ON public.global_settings;
CREATE POLICY "admins_manage_global_settings"
  ON public.global_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "authenticated_read_global_settings" ON public.global_settings;
CREATE POLICY "authenticated_read_global_settings"
  ON public.global_settings
  FOR SELECT
  TO authenticated
  USING (true);
