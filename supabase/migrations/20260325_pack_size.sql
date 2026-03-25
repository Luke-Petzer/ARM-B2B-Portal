-- Pack size: how many units per sellable pack
-- price in products table represents the pack price (VAT exclusive)
-- unit_price = price / pack_size (for display only)
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 1;
