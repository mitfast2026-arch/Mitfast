-- Migration 005: Categories
-- Single level product categories managed by Admin

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX categories_name_idx ON categories(name);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public read for storefront, suppliers, and buyers
CREATE POLICY "categories_select_all"
  ON categories FOR SELECT
  TO authenticated, anon
  USING (true);
