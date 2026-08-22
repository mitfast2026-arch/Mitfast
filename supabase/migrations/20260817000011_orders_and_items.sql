-- Migration 011: Orders & Order Items
-- Historical immutability: all pricing, address, product, and supplier data snapshotted.

CREATE TABLE orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number              TEXT NOT NULL UNIQUE,
  customer_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  rfq_id                    UUID REFERENCES rfqs(id) ON DELETE SET NULL,
  enquiry_id                UUID REFERENCES enquiries(id) ON DELETE SET NULL,
  status                    order_status NOT NULL DEFAULT 'accepted',
  payment_status            payment_status NOT NULL DEFAULT 'payment_required',
  delivery_address_snapshot JSONB NOT NULL,
  subtotal                  NUMERIC(18, 4) NOT NULL,
  total                     NUMERIC(18, 4) NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX orders_customer_id_idx    ON orders(customer_id);
CREATE INDEX orders_status_idx         ON orders(status);
CREATE INDEX orders_payment_status_idx ON orders(payment_status);
CREATE INDEX orders_order_number_idx   ON orders(order_number);
CREATE INDEX orders_created_at_idx     ON orders(created_at DESC);

-- Order Items
CREATE TABLE order_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id             UUID REFERENCES products(id) ON DELETE SET NULL,
  supplier_id            UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  product_name_snapshot  TEXT NOT NULL,
  supplier_name_snapshot TEXT NOT NULL,
  quantity               INTEGER NOT NULL CHECK (quantity > 0),
  unit_price             NUMERIC(18, 4) NOT NULL,
  currency_code          TEXT NOT NULL DEFAULT 'INR',
  gst_rate               NUMERIC(5, 2) NOT NULL DEFAULT 0,
  gst_included           BOOLEAN NOT NULL DEFAULT false,
  discount               NUMERIC(18, 4) NOT NULL DEFAULT 0,
  subtotal               NUMERIC(18, 4) NOT NULL,
  gst_amount             NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total                  NUMERIC(18, 4) NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_id_idx    ON order_items(order_id);
CREATE INDEX order_items_supplier_id_idx ON order_items(supplier_id);
CREATE INDEX order_items_product_id_idx  ON order_items(product_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_customer_select_own"
  ON orders FOR SELECT
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "order_items_customer_select_own"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN profiles p ON o.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
