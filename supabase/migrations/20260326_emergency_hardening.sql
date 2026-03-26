-- ============================================================
-- Migration: Emergency Hardening (2026-03-26)
-- Fix W-6: Performance indexes on high-traffic columns
-- Fix C-2: Atomic order + order_items creation function
-- SAFE TO RE-RUN: uses IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

-- ── W-6: Indexes ─────────────────────────────────────────────
-- orders.profile_id — every buyer order-history query does a full scan without this
CREATE INDEX IF NOT EXISTS idx_orders_profile_id
  ON public.orders (profile_id);

-- orders.payment_status — ledger filter used on every admin page load
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);

-- orders.status — second most common ledger filter
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

-- order_items.order_id — joined on every expanded order row; critical for report queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);


-- ── C-2: Atomic order creation function ──────────────────────
--
-- Wraps both INSERTs in a single implicit transaction so that either
-- both rows land or neither does. Eliminates the orphaned-order risk
-- from the previous two-step insert + compensating-delete pattern.
--
-- Parameters
--   p_order  jsonb  — order header fields (see checkout.ts for shape)
--   p_items  jsonb  — JSON array of order_item objects
--
-- Returns
--   uuid  — the newly created orders.id (used for redirect + email dispatch)
--
-- Security
--   SECURITY DEFINER so the function executes with owner (postgres) privileges.
--   The caller must be service_role (adminClient); RLS is intentionally bypassed
--   here because the server action already validates session + business rules.
--   SET search_path pins the schema to prevent search_path injection.

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order  jsonb,
  p_items  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- 1. Insert order header
  INSERT INTO public.orders (
    profile_id,
    status,
    payment_method,
    subtotal,
    discount_amount,
    vat_amount,
    total_amount,
    order_notes
  )
  VALUES (
    (p_order->>'profile_id')::uuid,
    (p_order->>'status')::public.order_status,
    (p_order->>'payment_method')::public.payment_method,
    (p_order->>'subtotal')::numeric,
    (p_order->>'discount_amount')::numeric,
    (p_order->>'vat_amount')::numeric,
    (p_order->>'total_amount')::numeric,
    -- ->>  returns TEXT; returns SQL NULL when key is absent or value is JSON null
    p_order->>'order_notes'
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
    -- product_id is nullable: NULLIF guards against empty string from JSON serialisation
    NULLIF(item->>'product_id', '')::uuid,
    item->>'sku',
    item->>'product_name',
    (item->>'unit_price')::numeric,
    -- cost_price is nullable — preserve NULL when not set
    CASE WHEN (item->>'cost_price') IS NULL
         THEN NULL
         ELSE (item->>'cost_price')::numeric
    END,
    (item->>'pack_size')::integer,
    (item->>'quantity')::integer,
    (item->>'discount_pct')::numeric,
    (item->>'line_total')::numeric,
    -- variant_info is nullable jsonb — convert JSON null to SQL NULL
    NULLIF(item->'variant_info', 'null'::jsonb)
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$;

-- Grant execute to service_role (the only caller via adminClient)
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb, jsonb)
  TO service_role;
