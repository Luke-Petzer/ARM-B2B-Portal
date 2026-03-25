-- Ensure pack_size is always >= 1 to prevent division-by-zero in unit price calculations
ALTER TABLE products
  ADD CONSTRAINT products_pack_size_positive CHECK (pack_size >= 1);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_pack_size_positive CHECK (pack_size >= 1);
