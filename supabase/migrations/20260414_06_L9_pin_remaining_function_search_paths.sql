-- [L9] LOW: Pin search_path on remaining trigger/helper functions
--
-- Finding: generate_order_reference(), handle_updated_at(), and
-- validate_line_total() have no SET search_path. These functions run
-- inside triggers with invoker privileges, but for defense-in-depth
-- every function should pin its search_path. record_order_status_change
-- is already pinned to `public` only; extend it to include pg_temp for
-- consistency with C1.

ALTER FUNCTION public.generate_order_reference()   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()          SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_line_total()        SET search_path = public, pg_temp;
ALTER FUNCTION public.record_order_status_change() SET search_path = public, pg_temp;
