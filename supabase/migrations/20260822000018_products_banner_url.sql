-- Catalog page banner lives on the existing business_settings singleton.
-- File is stored in the business-assets bucket (no extra image table).

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS products_banner_url TEXT;
