-- Product version snapshots for admin price/spec edits (spec §16).

CREATE TABLE IF NOT EXISTS product_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_versions_product_id_idx
  ON product_versions(product_id, created_at DESC);

ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
