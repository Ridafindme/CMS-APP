-- Add landline column to clinics table
ALTER TABLE clinics
ADD COLUMN IF NOT EXISTS landline VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN clinics.mobile IS 'Mobile number with country code (E.164 format: +961XXXXXXXX)';
COMMENT ON COLUMN clinics.landline IS 'Landline number with country code (E.164 format: +961XXXXXXXX)';
COMMENT ON COLUMN clinics.whatsapp IS 'WhatsApp number with country code (E.164 format: +961XXXXXXXX)';
