-- Migration 006: Products, Product Images, and Specifications
-- Central catalog with decoupled approval, publication, and archive states.

CREATE TABLE products (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id                    UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  category_id                    UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name                           TEXT NOT NULL,
  description                    TEXT,
  moq                            INTEGER NOT NULL CHECK (moq > 0),
  supplier_price                 NUMERIC(18, 4) NOT NULL CHECK (supplier_price >= 0),
  profit_type                    profit_type NOT NULL DEFAULT 'percentage',
  profit_value                   NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (profit_value >= 0),
  selling_price                  NUMERIC(18, 4) NOT NULL DEFAULT 0,
  discount                       NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  gst_rate                       NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (gst_rate >= 0 AND gst_rate <= 100),
  gst_included                   BOOLEAN NOT NULL DEFAULT false,
  ribbon_label                   TEXT,
  approval_status                product_approval_status NOT NULL DEFAULT 'pending',
  publication_status             product_publication_status NOT NULL DEFAULT 'unpublished',
  archive_status                 product_archive_status NOT NULL DEFAULT 'active',
  rejection_reason               TEXT,
  pre_archive_publication_status product_publication_status,
  view_count                     INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Catalog performance indexes
CREATE INDEX products_supplier_id_idx         ON products(supplier_id);
CREATE INDEX products_category_id_idx         ON products(category_id);
CREATE INDEX products_approval_status_idx     ON products(approval_status);
CREATE INDEX products_publication_status_idx  ON products(publication_status);
CREATE INDEX products_archive_status_idx      ON products(archive_status);
CREATE INDEX products_name_trgm               ON products USING gin(name gin_trgm_ops);
CREATE INDEX products_created_at_idx          ON products(created_at DESC);

-- Product Images table (up to 8 images per product)
CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_images_product_id_idx ON product_images(product_id);
CREATE UNIQUE INDEX product_images_primary_idx
  ON product_images(product_id)
  WHERE is_primary = true;

-- Product Specifications table (key-value specification matrix)
CREATE TABLE product_specifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  spec_name  TEXT NOT NULL,
  spec_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX product_specs_product_id_idx ON product_specifications(product_id);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specifications ENABLE ROW LEVEL SECURITY;

-- Products RLS
CREATE POLICY "products_storefront_select"
  ON products FOR SELECT
  TO authenticated, anon
  USING (
    publication_status = 'published'
    AND archive_status = 'active'
    AND approval_status = 'approved'
  );

CREATE POLICY "products_supplier_select_own"
  ON products FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "products_supplier_insert"
  ON products FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "products_supplier_update_own"
  ON products FOR UPDATE
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  );

-- Product Images RLS
CREATE POLICY "product_images_storefront_select"
  ON product_images FOR SELECT
  TO authenticated, anon
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE publication_status = 'published'
        AND archive_status = 'active'
        AND approval_status = 'approved'
    )
  );

CREATE POLICY "product_images_supplier_select_own"
  ON product_images FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "product_images_supplier_insert"
  ON product_images FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "product_images_supplier_delete"
  ON product_images FOR DELETE
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- Product Specifications RLS
CREATE POLICY "product_specs_storefront_select"
  ON product_specifications FOR SELECT
  TO authenticated, anon
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE publication_status = 'published'
        AND archive_status = 'active'
        AND approval_status = 'approved'
    )
  );

CREATE POLICY "product_specs_supplier_select_own"
  ON product_specifications FOR SELECT
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "product_specs_supplier_insert"
  ON product_specifications FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY "product_specs_supplier_delete"
  ON product_specifications FOR DELETE
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );
