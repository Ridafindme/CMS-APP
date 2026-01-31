-- Central currency registry to drive clinic pricing
CREATE TABLE IF NOT EXISTS public.currencies (
  currency_code TEXT PRIMARY KEY,
  currency_name_en TEXT NOT NULL,
  currency_name_ar TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on changes
CREATE OR REPLACE FUNCTION public.touch_currencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_currencies_touch ON public.currencies;
CREATE TRIGGER trg_currencies_touch
BEFORE UPDATE ON public.currencies
FOR EACH ROW
EXECUTE FUNCTION public.touch_currencies_updated_at();

-- Seed mandatory currencies (Lebanese Pound & US Dollar)
INSERT INTO public.currencies (currency_code, currency_name_en, currency_name_ar, currency_symbol, is_active, sort_order)
VALUES
  ('LBP', 'Lebanese Pound', 'الليرة اللبنانية', 'ل.ل.', TRUE, 10),
  ('USD', 'US Dollar', 'الدولار الأميركي', '$', TRUE, 20)
ON CONFLICT (currency_code) DO UPDATE SET
  currency_name_en = EXCLUDED.currency_name_en,
  currency_name_ar = EXCLUDED.currency_name_ar,
  currency_symbol = EXCLUDED.currency_symbol,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Ensure existing clinics default to the closest active currency
UPDATE public.clinics AS cl
SET consultation_currency = COALESCE(
  NULLIF(cl.consultation_currency, ''),
  (SELECT currency_code FROM public.currencies WHERE currency_code = 'LBP')
)
WHERE cl.consultation_currency IS NULL OR cl.consultation_currency = '';
