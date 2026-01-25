-- Rename phone column to mobile in clinics table for clarity
ALTER TABLE clinics
RENAME COLUMN phone TO mobile;

-- Update comment
COMMENT ON COLUMN clinics.mobile IS 'Mobile number with country code (E.164 format: +961XXXXXXXX)';
