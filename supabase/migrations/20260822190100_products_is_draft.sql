-- Draft products: partial saves excluded from storefront and approval queue until finalized.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_is_draft_idx ON products(is_draft) WHERE is_draft = true;

COMMENT ON COLUMN products.is_draft IS 'When true, product is an unpublished admin draft not yet submitted for approval.';
