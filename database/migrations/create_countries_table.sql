-- Add phone configuration columns to existing countries table
ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS iso_code VARCHAR(3),
ADD COLUMN IF NOT EXISTS flag_emoji VARCHAR(10),
ADD COLUMN IF NOT EXISTS phone_config JSONB,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create indexes for phone lookups
CREATE INDEX IF NOT EXISTS idx_countries_country_code ON countries(country_code);
CREATE INDEX IF NOT EXISTS idx_countries_default ON countries(is_default) WHERE is_default = true;

-- Update or insert Lebanon configuration
INSERT INTO countries (
  code,
  name_en,
  name_ar,
  country_code,
  iso_code,
  flag_emoji,
  phone_config,
  is_active,
  is_default,
  sort_order
) VALUES (
  'LB',
  'Lebanon',
  'لبنان',
  '961',
  'LBN',
  '🇱🇧',
  '{
    "landline_prefixes": ["01", "05", "04", "09", "06", "07", "08"],
    "mobile_prefixes": ["78", "76", "70", "81", "03", "86"],
    "phone_length": 8,
    "format_display": "{prefix} {middle} {last}",
    "format_pattern": "XX XXX XXX"
  }'::jsonb,
  true,
  true,
  1
)
ON CONFLICT (code) 
DO UPDATE SET
  country_code = EXCLUDED.country_code,
  iso_code = EXCLUDED.iso_code,
  flag_emoji = EXCLUDED.flag_emoji,
  phone_config = EXCLUDED.phone_config,
  is_default = EXCLUDED.is_default;

-- Enable RLS if not already enabled
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Anyone can view active countries" ON countries;

CREATE POLICY "Anyone can view active countries"
  ON countries FOR SELECT
  USING (is_active = true);

