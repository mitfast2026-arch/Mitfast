-- Migration 060: Homepage CMS (hero slides, containers cutout, curated carousel products)

CREATE TABLE homepage_hero_slides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  image_url     TEXT NOT NULL,
  storage_path  TEXT,
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  subtitle      TEXT NOT NULL DEFAULT '',
  cta1_label    TEXT NOT NULL DEFAULT '',
  cta1_href     TEXT NOT NULL DEFAULT '',
  cta2_label    TEXT NOT NULL DEFAULT '',
  cta2_href     TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX homepage_hero_slides_active_sort_idx
  ON homepage_hero_slides (is_active, sort_order);

CREATE TRIGGER homepage_hero_slides_updated_at
  BEFORE UPDATE ON homepage_hero_slides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE homepage_assets (
  id                        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  containers_image_url      TEXT,
  containers_storage_path   TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER homepage_assets_updated_at
  BEFORE UPDATE ON homepage_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE homepage_carousel_products (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  override_image_url      TEXT,
  override_storage_path   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT homepage_carousel_products_product_unique UNIQUE (product_id)
);

CREATE INDEX homepage_carousel_products_active_sort_idx
  ON homepage_carousel_products (is_active, sort_order);

CREATE TRIGGER homepage_carousel_products_updated_at
  BEFORE UPDATE ON homepage_carousel_products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE homepage_hero_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_carousel_products ENABLE ROW LEVEL SECURITY;

-- Public read (storefront); writes go through service-role admin APIs
CREATE POLICY "homepage_hero_slides_select_public"
  ON homepage_hero_slides FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "homepage_assets_select_public"
  ON homepage_assets FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "homepage_carousel_products_select_public"
  ON homepage_carousel_products FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed: current hero copy + static image (CMS-owned from day one)
INSERT INTO homepage_hero_slides (
  sort_order,
  is_active,
  image_url,
  eyebrow,
  title,
  subtitle,
  cta1_label,
  cta1_href,
  cta2_label,
  cta2_href
)
VALUES (
  0,
  true,
  '/images/homepage_banner_1.png',
  'B2B SOURCING. FACTORY-DIRECT PRICING.',
  'B2B Procurement.' || E'\n' || 'Made Simple.',
  'Buy precision components, request quotes, and place orders from verified suppliers — all in one B2B marketplace.',
  'Explore Services',
  '/#services',
  'Get a Quote',
  '/enquiry'
);

-- Seed: containers cutout singleton
INSERT INTO homepage_assets (id, containers_image_url)
VALUES (1, '/images/container.png');

-- Seed: up to 12 newest published products into curated carousel
INSERT INTO homepage_carousel_products (product_id, sort_order, is_active)
SELECT p.id, row_number() OVER (ORDER BY p.created_at DESC) - 1, true
FROM products p
WHERE p.publication_status = 'published'
  AND p.archive_status = 'active'
  AND p.approval_status = 'approved'
ORDER BY p.created_at DESC
LIMIT 12;
