-- Persist supplier notification preferences (email toggles).
-- Default mirrors the previous local-only UI defaults.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB
  NOT NULL
  DEFAULT '{"emailRfqs":true,"emailOrders":true,"emailApprovals":true}'::jsonb;

COMMENT ON COLUMN suppliers.notification_preferences IS
  'Supplier email alert preferences: emailRfqs, emailOrders, emailApprovals';
