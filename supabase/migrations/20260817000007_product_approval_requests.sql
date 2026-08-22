-- Migration 007: Product Approval Requests
-- Dedicated queue for Admin review of new products and updates to existing products.

CREATE TABLE product_approval_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  request_type     TEXT NOT NULL CHECK (request_type IN ('new_product', 'update')),
  proposed_data    JSONB NOT NULL,
  status           product_approval_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX par_product_id_idx ON product_approval_requests(product_id);
CREATE INDEX par_status_idx     ON product_approval_requests(status);
CREATE INDEX par_created_at_idx ON product_approval_requests(created_at DESC);

ALTER TABLE product_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "par_supplier_select_own"
  ON product_approval_requests FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "par_supplier_insert_own"
  ON product_approval_requests FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );
