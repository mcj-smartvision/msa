-- =====================================================
-- Smart progress — configurable pace thresholds (بخش ۴)
-- Run once in Supabase SQL Editor after migration 78
-- =====================================================

ALTER TABLE public.project_alert_settings
  ADD COLUMN IF NOT EXISTS pace_good_threshold NUMERIC NOT NULL DEFAULT 0.9;

ALTER TABLE public.project_alert_settings
  ADD COLUMN IF NOT EXISTS pace_warning_threshold NUMERIC NOT NULL DEFAULT 0.6;

COMMENT ON COLUMN public.project_alert_settings.pace_good_threshold IS
  'نرخ پیشروی >= این مقدار → pace_status good (پیش‌فرض ۰.۹)';

COMMENT ON COLUMN public.project_alert_settings.pace_warning_threshold IS
  'نرخ پیشروی >= این مقدار و < good → warning؛ کمتر → bad (پیش‌فرض ۰.۶)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_alert_settings_pace_thresholds_check'
  ) THEN
    ALTER TABLE public.project_alert_settings
      ADD CONSTRAINT project_alert_settings_pace_thresholds_check
      CHECK (
        pace_good_threshold > 0
        AND pace_good_threshold <= 1
        AND pace_warning_threshold > 0
        AND pace_warning_threshold <= 1
        AND pace_warning_threshold < pace_good_threshold
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
