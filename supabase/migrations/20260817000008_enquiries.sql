-- Migration 008: Enquiries
-- Supports both Guest and Customer enquiries with guest-to-account linking capability.

CREATE TABLE enquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name  TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  status      enquiry_status NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER enquiries_updated_at
  BEFORE UPDATE ON enquiries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for search, filter, and guest-linking
CREATE INDEX enquiries_customer_id_idx ON enquiries(customer_id);
CREATE INDEX enquiries_guest_email_idx ON enquiries(guest_email);
CREATE INDEX enquiries_guest_phone_idx ON enquiries(guest_phone);
CREATE INDEX enquiries_status_idx      ON enquiries(status);
CREATE INDEX enquiries_created_at_idx  ON enquiries(created_at DESC);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Customers can view their own linked enquiries
CREATE POLICY "enquiries_customer_select_own"
  ON enquiries FOR SELECT
  USING (
    customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Open insert for both guests and authenticated customers (validated server-side)
CREATE POLICY "enquiries_insert_public"
  ON enquiries FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
