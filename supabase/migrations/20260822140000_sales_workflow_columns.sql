-- Sales workflow: enquiry → RFQ → order pipeline columns

ALTER TYPE public.enquiry_status ADD VALUE IF NOT EXISTS 'converted_to_rfq';

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS enquiry_type TEXT NOT NULL DEFAULT 'general';

ALTER TABLE rfqs
  ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rfqs_enquiry_id_idx ON rfqs(enquiry_id);

COMMENT ON COLUMN enquiries.country IS 'Buyer country captured at submission.';
COMMENT ON COLUMN enquiries.company_name IS 'Optional company name from enquiry form.';
COMMENT ON COLUMN enquiries.enquiry_type IS 'Source: product, contact, custom, sourcing, procurement, dispatch, cart.';
COMMENT ON COLUMN rfqs.enquiry_id IS 'Source enquiry when RFQ was created from a lead.';
