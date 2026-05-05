-- Migration: 20260504_02_phase2_hardening.sql
--
-- Phase 2 Security Hardening
-- ──────────────────────────
-- Two independent hardening steps, both confirmed safe by the
-- pre-migration investigation on branch investigate/phase2-force-rls-impact
-- (PR #17, approved 2026-05-05).
--
-- Background on role attributes (queried from live DB):
--
--   Role            rolsuper  rolbypassrls
--   ─────────────── ───────── ────────────
--   postgres        false     TRUE          ← owns all tables; BYPASSRLS
--   service_role    false     TRUE          ← used by adminClient; BYPASSRLS
--   authenticated   false     false         ← buyer JWT; subject to RLS
--
-- Because both postgres (table owner) and service_role (adminClient) have
-- rolbypassrls = true, FORCE ROW LEVEL SECURITY has ZERO operational impact
-- on any existing write path. It closes the theoretical gap where a future
-- misconfigured role with owner-level privileges could silently bypass buyer
-- RLS policies.
--
-- SECURITY DEFINER functions run as postgres (rolbypassrls = true), so
-- FORCE RLS does not affect them either. The search_path hardening below is
-- an independent, orthogonal fix.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — FORCE ROW LEVEL SECURITY on all 14 application tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Pre-flight state (all 14 tables had relforcerowsecurity = false):
--   All tables already had relrowsecurity = true (standard RLS enabled).
--   This step sets relforcerowsecurity = true to remove the owner bypass
--   for any future role that lacks rolbypassrls.
--
-- Expected impact: none on existing operations.
-- Rollback: ALTER TABLE <name> NO FORCE ROW LEVEL SECURITY; (see end of file)

ALTER TABLE public.addresses            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_sessions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categories           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_custom_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_images       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config        FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — Harden search_path on four SECURITY DEFINER functions
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Background:
--   SECURITY DEFINER functions run with the privileges of their owner
--   (postgres, rolbypassrls = true). If a malicious schema is inserted
--   before 'public' in the search_path, it can shadow standard objects
--   (e.g., replace pg_catalog types or public functions) with attacker-
--   controlled versions. Adding pg_temp last closes this vector because
--   pg_temp is the final fallback schema and cannot be populated by
--   the invoking session during function execution.
--
-- Functions already hardened (no change needed):
--   create_order_atomic    — search_path = public, pg_temp  ✓
--   generate_order_reference — search_path = public, pg_temp ✓ (via L9 migration)
--   handle_updated_at      — search_path = public, pg_temp  ✓ (via L9 migration)
--   validate_line_total    — search_path = public, pg_temp  ✓ (via L9 migration)
--   record_order_status_change — search_path = public, pg_temp ✓ (via L9 migration)
--
-- Functions requiring hardening (pre-flight search_path = 'public' only):
--
--   Function                    Args              Current         Required
--   ─────────────────────────── ───────────────── ─────────────── ──────────────────
--   handle_new_buyer_user       ()                public          public, pg_temp
--   handle_new_admin_user       ()                public          public, pg_temp
--   custom_access_token_hook    (event jsonb)     public          public, pg_temp
--   log_table_audit             ()                public          public, pg_temp
--
-- Expected impact: none. search_path change only; no body changes.
-- Rollback: ALTER FUNCTION ... SET search_path = public; (see end of file)

ALTER FUNCTION public.handle_new_buyer_user()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_admin_user()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.custom_access_token_hook(event jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.log_table_audit()
  SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-FLIGHT VERIFICATION QUERIES
-- Run these in the Supabase SQL Editor immediately after applying the migration.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Confirm FORCE RLS enabled on all 14 tables (expect force_rls = true for all):
--
-- SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS force_rls
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
--   AND c.relname IN (
--     'addresses','audit_log','buyer_sessions','categories',
--     'client_custom_prices','global_settings','order_items',
--     'order_status_history','orders','payments','product_images',
--     'products','profiles','tenant_config'
--   )
-- ORDER BY relname;
--
-- 2. Confirm search_path updated on all 4 functions (expect 'public, pg_temp' for all):
--
-- SELECT p.proname AS function_name,
--        (SELECT option_value FROM pg_options_to_table(p.proconfig)
--         WHERE option_name = 'search_path') AS search_path
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'handle_new_buyer_user','handle_new_admin_user',
--     'custom_access_token_hook','log_table_audit'
--   )
-- ORDER BY p.proname;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK SQL
-- Apply in the SQL Editor if the migration needs to be reverted.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- -- Part 1 rollback: remove FORCE RLS from all 14 tables
-- ALTER TABLE public.addresses            NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.audit_log            NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.buyer_sessions       NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.categories           NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.client_custom_prices NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.global_settings      NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_items          NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.order_status_history NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders               NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.payments             NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.product_images       NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.products             NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles             NO FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.tenant_config        NO FORCE ROW LEVEL SECURITY;
--
-- -- Part 2 rollback: revert search_path to public only
-- ALTER FUNCTION public.handle_new_buyer_user()              SET search_path = public;
-- ALTER FUNCTION public.handle_new_admin_user()              SET search_path = public;
-- ALTER FUNCTION public.custom_access_token_hook(event jsonb) SET search_path = public;
-- ALTER FUNCTION public.log_table_audit()                    SET search_path = public;
