-- Enforce quality guest contact data on enquiries (name, email, phone already NOT NULL).

ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_guest_name_len;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_guest_name_len
  CHECK (char_length(trim(guest_name)) >= 2);

ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_guest_email_format;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_guest_email_format
  CHECK (guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

ALTER TABLE enquiries DROP CONSTRAINT IF EXISTS enquiries_guest_phone_len;
ALTER TABLE enquiries ADD CONSTRAINT enquiries_guest_phone_len
  CHECK (char_length(trim(guest_phone)) >= 7);

COMMENT ON CONSTRAINT enquiries_guest_name_len ON enquiries IS 'Guest/customer name required for enquiry follow-up';
COMMENT ON CONSTRAINT enquiries_guest_email_format ON enquiries IS 'Valid email required for enquiry follow-up';
COMMENT ON CONSTRAINT enquiries_guest_phone_len ON enquiries IS 'Phone required for enquiry follow-up';
