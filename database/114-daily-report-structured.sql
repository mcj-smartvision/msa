-- =====================================================
-- Structured 12-section daily site report + photo tags
-- Run once in Supabase SQL Editor (after 113).
-- =====================================================

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS structured_json JSONB;

COMMENT ON COLUMN public.daily_reports.structured_json IS
  'LipartaDailyReportData — 12-section voice/form site report JSON';

ALTER TABLE public.daily_report_photos
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS linked_activity_or_location TEXT;

COMMENT ON COLUMN public.daily_report_photos.caption IS
  'برچسب فارسی عکس';
COMMENT ON COLUMN public.daily_report_photos.linked_activity_or_location IS
  'اتصال عکس به فعالیت / زون / محل (نه گالری فله‌ای)';

CREATE INDEX IF NOT EXISTS idx_daily_reports_structured
  ON public.daily_reports (project_id)
  WHERE structured_json IS NOT NULL;

SELECT 'daily_report_structured ready' AS status;
