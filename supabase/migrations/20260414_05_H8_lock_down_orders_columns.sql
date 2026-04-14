-- [H8] HIGH: Restrict buyer access to internal orders columns
--
-- Finding: The orders SELECT policy returned all columns to the buyer,
-- including the internal "notes" column (staff comments) and
-- "assigned_to" (which admin employee is handling the order). Buyers
-- using a direct client query could read these internal fields.
--
-- Fix: Use column-level REVOKE/GRANT to hide notes and assigned_to
-- from authenticated/anon roles. The service-role admin client used by
-- all buyer-facing pages bypasses column grants entirely, so admin
-- reads and buyer UI both continue to work.
--
-- Note: `order_notes` is the buyer-supplied checkout notes field and
-- remains visible. `notes` is the internal staff field.

-- Revoke blanket SELECT, then re-grant everything except internal fields.
REVOKE SELECT ON public.orders FROM authenticated;
REVOKE SELECT ON public.orders FROM anon;

GRANT SELECT (
  id,
  reference_number,
  profile_id,
  status,
  payment_method,
  payment_status,
  subtotal,
  discount_amount,
  vat_amount,
  total_amount,
  shipping_address,
  buyer_reference,
  delivery_instructions,
  order_notes,
  confirmed_at,
  fulfilled_at,
  cancelled_at,
  created_at,
  updated_at
) ON public.orders TO authenticated;
