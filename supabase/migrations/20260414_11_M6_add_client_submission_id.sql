-- [M6] MEDIUM: Idempotency token for checkout
--
-- Adds a nullable, uniquely-indexed client_submission_id column to orders.
-- The checkout action will set this from a client-generated UUID on each
-- submission. If a duplicate is attempted, the unique index rejects it,
-- preventing double-order creation from retry/double-click.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_submission_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_client_submission_id
  ON public.orders (client_submission_id)
  WHERE client_submission_id IS NOT NULL;
