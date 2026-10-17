-- =====================================================
-- Ensure multiple archived reports per day (idempotent)
-- Run in Supabase SQL Editor if archive overwrites / unique-day errors appear.
-- Safe to re-run after 113.
-- =====================================================

ALTER TABLE public.daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_unique_day;

-- Keep at most one open draft per supervisor+project
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_reports_one_open_draft
  ON public.daily_reports (project_id, site_supervisor_id)
  WHERE workflow_status = 'draft';

COMMENT ON INDEX public.uq_daily_reports_one_open_draft IS
  'Only one open draft; archived/submitted rows may share the same report_date';

SELECT 'daily_report_multi_archive ready' AS status;
