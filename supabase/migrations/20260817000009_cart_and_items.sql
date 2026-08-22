-- Migration 009: Cart & Cart Items
-- Persistent server-side cart for multi-product RFQ creation

CREATE TABLE carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

CREATE INDEX cart_items_cart_id_idx ON cart_items(cart_id);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_select_own"
  ON carts FOR SELECT
  USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "cart_items_select_own"
  ON cart_items FOR SELECT
  USING (
    cart_id IN (
      SELECT c.id FROM carts c
      JOIN profiles p ON c.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items_insert_own"
  ON cart_items FOR INSERT
  WITH CHECK (
    cart_id IN (
      SELECT c.id FROM carts c
      JOIN profiles p ON c.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items_update_own"
  ON cart_items FOR UPDATE
  USING (
    cart_id IN (
      SELECT c.id FROM carts c
      JOIN profiles p ON c.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    cart_id IN (
      SELECT c.id FROM carts c
      JOIN profiles p ON c.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "cart_items_delete_own"
  ON cart_items FOR DELETE
  USING (
    cart_id IN (
      SELECT c.id FROM carts c
      JOIN profiles p ON c.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
