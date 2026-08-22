-- Migration 017: Enquiry response fields (additive)
-- Enables admin/supplier replies visible to customers and track pages.

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS response_message TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS enquiries_responded_at_idx ON enquiries(responded_at DESC);
