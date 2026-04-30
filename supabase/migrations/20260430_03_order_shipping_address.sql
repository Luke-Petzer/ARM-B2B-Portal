-- ============================================================
-- Migration: Add shipping_address to create_order_atomic (2026-04-30)
-- The orders.shipping_address JSONB column already exists but
-- was never populated. This migration updates the atomic order
-- creation function to accept and store the shipping address.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order  jsonb,
  p_items  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- [L10] Runtime caller-role guard
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'create_order_atomic: unauthorized caller role %', COALESCE(auth.role(), 'null')
      USING ERRCODE = '42501';
  END IF;

  -- 1. Insert order header (now includes shipping_address)
  INSERT INTO public.orders (
    profile_id,
    status,
    payment_method,
    subtotal,
    discount_amount,
    vat_amount,
    total_amount,
    order_notes,
    shipping_address
  )
  VALUES (
    (p_order->>'profile_id')::uuid,
    (p_order->>'status')::public.order_status,
    (p_order->>'payment_method')::public.payment_method,
    (p_order->>'subtotal')::numeric,
    (p_order->>'discount_amount')::numeric,
    (p_order->>'vat_amount')::numeric,
    (p_order->>'total_amount')::numeric,
    p_order->>'order_notes',
    CASE WHEN p_order->'shipping_address' IS NULL OR p_order->'shipping_address' = 'null'::jsonb
         THEN NULL
         ELSE p_order->'shipping_address'
    END
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert all line items in a single statement
  INSERT INTO public.order_items (
    order_id,
    product_id,
    sku,
    product_name,
    unit_price,
    cost_price,
    pack_size,
    quantity,
    discount_pct,
    line_total,
    variant_info
  )
  SELECT
    v_order_id,
    NULLIF(item->>'product_id', '')::uuid,
    item->>'sku',
    item->>'product_name',
    (item->>'unit_price')::numeric,
    CASE WHEN (item->>'cost_price') IS NULL
         THEN NULL
         ELSE (item->>'cost_price')::numeric
    END,
    (item->>'pack_size')::integer,
    (item->>'quantity')::integer,
    (item->>'discount_pct')::numeric,
    (item->>'line_total')::numeric,
    NULLIF(item->'variant_info', 'null'::jsonb)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$;

-- Re-assert grants
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_order_atomic(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb, jsonb) TO service_role;
