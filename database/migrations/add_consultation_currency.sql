-- Add currency metadata to countries
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS currency_code TEXT,
  ADD COLUMN IF NOT EXISTS currency_name TEXT,
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT;

-- Ensure Lebanon (default) has currency data
UPDATE public.countries
SET currency_code = COALESCE(currency_code, 'LBP'),
    currency_name = COALESCE(currency_name, 'Lebanese Pound'),
    currency_symbol = COALESCE(currency_symbol, 'ل.ل.')
WHERE code = 'LB';

-- Add consultation currency to clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS consultation_currency TEXT;

-- Backfill clinic currency with default country when missing
UPDATE public.clinics AS cl
SET consultation_currency = c.currency_code
FROM public.countries AS c
WHERE c.is_default = true
  AND c.currency_code IS NOT NULL
  AND (cl.consultation_currency IS NULL OR cl.consultation_currency = '');
