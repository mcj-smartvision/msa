-- Sub-branch weight share (percent of 100 among siblings under same parent)
-- Run after migration 68

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS weight_percent NUMERIC;

COMMENT ON COLUMN public.workshop_packages.weight_percent IS 'سهم وزن زیرشاخه از ۱۰۰ نسبت به والد';

NOTIFY pgrst, 'reload schema';
