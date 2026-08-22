-- Migration 004: Suppliers
-- Business entity for suppliers, separate from auth. Multi-path creation (Admin or self-reg).

CREATE TABLE suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name     TEXT NOT NULL,
  contact_person   TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  address          TEXT,
  country          TEXT NOT NULL,
  website          TEXT,
  status           supplier_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for performance (1,000+ suppliers scale)
CREATE INDEX suppliers_user_id_idx         ON suppliers(user_id);
CREATE INDEX suppliers_status_idx          ON suppliers(status);
CREATE INDEX suppliers_country_idx         ON suppliers(country);
CREATE INDEX suppliers_company_name_trgm   ON suppliers USING gin(company_name gin_trgm_ops);
CREATE INDEX suppliers_contact_person_trgm ON suppliers USING gin(contact_person gin_trgm_ops);
CREATE INDEX suppliers_created_at_idx      ON suppliers(created_at DESC);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Supplier read own business details
CREATE POLICY "supplier_select_own"
  ON suppliers FOR SELECT
  USING (user_id = auth.uid());

-- Supplier update own business details
CREATE POLICY "supplier_update_own"
  ON suppliers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
