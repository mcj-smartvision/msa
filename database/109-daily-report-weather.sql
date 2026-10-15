-- =====================================================
-- Daily report weather snapshot — اسنپ‌شات هوا برای اسناد بعدی
-- Run once in Supabase SQL Editor. Safe to re-run; existing rows keep their data.
--
-- Live weather in the header is not the documentary record. Documents (site diary,
-- weekly pack) must read the conditions captured when the daily report was saved.
-- weather_json is structured numbers + Persian display line, not a parsed sentence.
-- =====================================================

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS weather_json jsonb;

COMMENT ON COLUMN public.daily_reports.weather_json IS
  'اسنپ‌شات وضعیت هوا در زمان ثبت گزارش روزانه (دما، رطوبت، باد، شرایط، مختصات). برای اسناد بعدی؛ زنده نیست.';

CREATE INDEX IF NOT EXISTS idx_daily_reports_weather_date
  ON public.daily_reports (project_id, report_date)
  WHERE weather_json IS NOT NULL;

NOTIFY pgrst, 'reload schema';
