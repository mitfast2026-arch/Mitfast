-- Migration 012: Business Settings
-- Singleton platform configuration (RFQ limits, tax defaults, branding, currency)

CREATE TABLE business_settings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name               TEXT NOT NULL DEFAULT 'MITFAST',
  logo_url                   TEXT,
  business_email             TEXT,
  business_phone             TEXT,
  business_address           TEXT,
  website                    TEXT,
  minimum_rfq_value          NUMERIC(18, 4) NOT NULL DEFAULT 500000,
  default_gst_rate           NUMERIC(5, 2) NOT NULL DEFAULT 18,
  currency                   TEXT NOT NULL DEFAULT 'INR',
  max_product_images         INTEGER NOT NULL DEFAULT 8,
  supplier_approval_required BOOLEAN NOT NULL DEFAULT true,
  product_approval_required  BOOLEAN NOT NULL DEFAULT true,
  google_login_enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER business_settings_updated_at
  BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Public read for storefront, customers, suppliers
CREATE POLICY "settings_select_public"
  ON business_settings FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed initial default configuration row
INSERT INTO business_settings (
  company_name,
  minimum_rfq_value,
  default_gst_rate,
  currency,
  max_product_images,
  supplier_approval_required,
  product_approval_required,
  google_login_enabled
)
VALUES (
  'MITFAST',
  500000,
  18,
  'INR',
  8,
  true,
  true,
  true
);
