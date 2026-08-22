-- Migration 010: RFQs & RFQ Items
-- Preserves customer original request and Admin negotiated values independently.

CREATE TABLE rfqs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number                TEXT NOT NULL UNIQUE,
  customer_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status                    rfq_status NOT NULL DEFAULT 'submitted',
  delivery_address_snapshot JSONB NOT NULL,
  customer_message          TEXT,
  original_total            NUMERIC(18, 4) NOT NULL,
  final_total               NUMERIC(18, 4),
  rejection_reason          TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER rfqs_updated_at
  BEFORE UPDATE ON rfqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX rfqs_customer_id_idx ON rfqs(customer_id);
CREATE INDEX rfqs_status_idx      ON rfqs(status);
CREATE INDEX rfqs_rfq_number_idx  ON rfqs(rfq_number);
CREATE INDEX rfqs_created_at_idx  ON rfqs(created_at DESC);

-- RFQ Line Items
CREATE TABLE rfq_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id                UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  original_quantity     INTEGER NOT NULL CHECK (original_quantity > 0),
  original_unit_price   NUMERIC(18, 4) NOT NULL,
  final_quantity        INTEGER CHECK (final_quantity IS NULL OR final_quantity > 0),
  final_unit_price      NUMERIC(18, 4) CHECK (final_unit_price IS NULL OR final_unit_price >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX rfq_items_rfq_id_idx ON rfq_items(rfq_id);
CREATE INDEX rfq_items_product_id_idx ON rfq_items(product_id);

ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfqs_customer_select_own"
  ON rfqs FOR SELECT
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "rfq_items_customer_select_own"
  ON rfq_items FOR SELECT
  USING (
    rfq_id IN (
      SELECT r.id FROM rfqs r
      JOIN profiles p ON r.customer_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
