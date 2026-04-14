-- [H1] HIGH: Drop buyer INSERT policy on order_items
--
-- Finding: buyers_insert_order_items let any authenticated buyer insert
-- arbitrary line items on their own orders via the anon client, bypassing
-- server-side pricing and forging totals.
--
-- Fix: Drop the policy. All order_items writes must go through the
-- server-side create_order_atomic() RPC (invoked from checkoutAction with
-- the service-role admin client). Additionally revoke buyer-side
-- INSERT/UPDATE/DELETE grants on order_items to enforce at the privilege
-- layer even if a future policy is reintroduced.

DROP POLICY IF EXISTS "buyers_insert_order_items" ON public.order_items;

REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon;
