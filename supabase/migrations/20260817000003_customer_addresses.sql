-- Migration 003: Customer Delivery Addresses
-- Single delivery address per customer, distinct from immutable order snapshots

CREATE TABLE customer_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  address_line_1  TEXT NOT NULL,
  address_line_2  TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  postal_code     TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'India',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX customer_addresses_customer_id_idx ON customer_addresses(customer_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "address_select_own"
  ON customer_addresses FOR SELECT
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "address_insert_own"
  ON customer_addresses FOR INSERT
  WITH CHECK (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "address_update_own"
  ON customer_addresses FOR UPDATE
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "address_delete_own"
  ON customer_addresses FOR DELETE
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
