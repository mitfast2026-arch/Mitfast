-- Production integration: columns required by storefront/admin that had no DB source.
-- Target: MITFAST project only (qubphaacuuwlpdrsprjl).

-- Products: SKU + stock (no warehouse table; quantity is product-level)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_stock_quantity_nonneg;

ALTER TABLE products
  ADD CONSTRAINT products_stock_quantity_nonneg CHECK (stock_quantity >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_idx
  ON products (sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

-- Product images: track Storage object path for delete/replace
ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Categories: DB-backed card imagery (bucket category-images)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_storage_path TEXT;

-- Enquiries: CAD / drawing attachment (bucket documents)
ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_path TEXT;

COMMENT ON COLUMN products.sku IS 'Optional product SKU; unique when set.';
COMMENT ON COLUMN products.stock_quantity IS 'Available quantity for storefront availability labels.';
COMMENT ON COLUMN product_images.storage_path IS 'Path inside product-images bucket; null for external URLs.';
COMMENT ON COLUMN categories.image_url IS 'Public URL for category card image.';
COMMENT ON COLUMN categories.image_storage_path IS 'Path inside category-images bucket.';
COMMENT ON COLUMN enquiries.attachment_url IS 'Public or signed URL for uploaded drawing/CAD.';
COMMENT ON COLUMN enquiries.attachment_path IS 'Path inside documents bucket.';
