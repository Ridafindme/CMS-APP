-- Migration: Add Walk-In Support to Appointments Table
-- Date: 2026-01-26
-- Description: Adds booking_type, walk_in_name, and walk_in_phone columns
--              to support both regular appointments and walk-in patients

-- Step 1: Create ENUM type for booking_type
DO $$ BEGIN
    CREATE TYPE booking_type_enum AS ENUM ('appointment', 'walk-in');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Make patient_id nullable (required for walk-in patients who don't have accounts)
ALTER TABLE appointments 
ALTER COLUMN patient_id DROP NOT NULL;

-- Step 3: Add booking_type column (defaults to 'appointment' for existing records)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS booking_type booking_type_enum DEFAULT 'appointment' NOT NULL;

-- Step 4: Add walk_in_name column (nullable, only for walk-ins)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS walk_in_name TEXT;

-- Step 5: Add walk_in_phone column (nullable, only for walk-ins)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS walk_in_phone TEXT;

-- Step 6: Add check constraint to ensure data integrity
ALTER TABLE appointments 
ADD CONSTRAINT check_booking_type_data 
CHECK (
  (booking_type = 'appointment' AND patient_id IS NOT NULL AND walk_in_name IS NULL AND walk_in_phone IS NULL) OR
  (booking_type = 'walk-in' AND walk_in_name IS NOT NULL AND walk_in_phone IS NOT NULL)
);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN appointments.booking_type IS 'Type of booking: appointment (regular patient) or walk-in (walk-in patient)';
COMMENT ON COLUMN appointments.walk_in_name IS 'Name of walk-in patient (only populated when booking_type = walk-in)';
COMMENT ON COLUMN appointments.walk_in_phone IS 'Phone number of walk-in patient (only populated when booking_type = walk-in)';

-- Step 8: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_booking_type ON appointments(booking_type);

-- Verification query (optional - run to check)
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'appointments' 
-- AND column_name IN ('booking_type', 'walk_in_name', 'walk_in_phone');
