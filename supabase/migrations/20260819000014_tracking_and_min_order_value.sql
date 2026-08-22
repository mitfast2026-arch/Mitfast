-- Tracking tokens for guest enquiry/order status pages.
-- Per-product minimum order value (optional; global RFQ min still applies).

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(18, 4) CHECK (min_order_value IS NULL OR min_order_value >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS enquiries_tracking_token_idx
  ON enquiries(tracking_token)
  WHERE tracking_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_idx
  ON orders(tracking_token)
  WHERE tracking_token IS NOT NULL;

UPDATE enquiries
SET tracking_token = replace(gen_random_uuid()::text, '-', '')
WHERE tracking_token IS NULL;

UPDATE orders
SET tracking_token = replace(gen_random_uuid()::text, '-', '')
WHERE tracking_token IS NULL;
