-- Add date_of_birth and gender columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female', NULL));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_date_of_birth ON profiles(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);

-- Add comments for documentation
COMMENT ON COLUMN profiles.date_of_birth IS 'Patient date of birth (optional)';
COMMENT ON COLUMN profiles.gender IS 'Patient gender: male, female, or NULL (optional)';
