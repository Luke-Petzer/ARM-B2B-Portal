-- Add order_notes column to orders table.
-- This column captures buyer-supplied notes and special requests at checkout.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_notes TEXT;
