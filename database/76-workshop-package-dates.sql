-- =====================================================
-- Workshop package own start/finish dates
-- Run once in Supabase SQL Editor
-- =====================================================

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS finish_date DATE;

COMMENT ON COLUMN public.workshop_packages.start_date IS
  'تاریخ شروع زیرمجموعه (قابل ویرایش مستقل از والد MSP)';
COMMENT ON COLUMN public.workshop_packages.finish_date IS
  'تاریخ پایان زیرمجموعه (قابل ویرایش مستقل از والد MSP)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workshop_packages_dates_order'
  ) THEN
    ALTER TABLE public.workshop_packages
      ADD CONSTRAINT workshop_packages_dates_order
      CHECK (
        start_date IS NULL
        OR finish_date IS NULL
        OR finish_date >= start_date
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
