-- [C1] CRITICAL: Pin search_path on SECURITY DEFINER functions
--
-- Finding: public.is_admin() and public.get_app_role() are SECURITY DEFINER
-- with no SET search_path. A malicious object in an earlier schema on the
-- caller's search_path could be resolved first, leading to privilege
-- escalation when these functions run with definer rights.
--
-- Fix: Pin search_path = public, pg_temp on both functions, and revoke
-- CREATE on schema public from anon/authenticated so buyers cannot plant
-- shadowing objects.

ALTER FUNCTION public.get_app_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()     SET search_path = public, pg_temp;

REVOKE CREATE ON SCHEMA public FROM authenticated;
REVOKE CREATE ON SCHEMA public FROM anon;
