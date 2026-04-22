-- [H2] HIGH: Drop buyer INSERT policy on payments
--
-- Finding: buyers_insert_own_payments had no WITH CHECK on status,
-- verified_by, verified_at, or amount. A buyer could insert a payment
-- row with status='verified', verified_by=<admin UUID>, and an
-- arbitrary amount against their own order, impersonating an admin
-- verification.
--
-- Fix: Drop the policy. markPaymentSubmittedAction uses the service-role
-- admin client exclusively, so no buyer-facing client-side insert is
-- needed. Revoke INSERT/UPDATE/DELETE grants on payments to buyers/anon
-- as defense-in-depth.

DROP POLICY IF EXISTS "buyers_insert_own_payments" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon;
