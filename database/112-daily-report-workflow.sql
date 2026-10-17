-- =====================================================
-- Daily report workflow: draft → finalized → submitted → approved
-- Run once in Supabase SQL Editor (after 111).
-- =====================================================

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_workflow_status_check;

ALTER TABLE public.daily_reports
  ADD CONSTRAINT daily_reports_workflow_status_check
  CHECK (workflow_status IN ('draft', 'finalized', 'submitted', 'approved'));

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_to_manager_at TIMESTAMPTZ;

COMMENT ON COLUMN public.daily_reports.workflow_status IS
  'draft=ویرایش آزاد؛ finalized=ثبت نهایی؛ submitted=ارسال به مدیر؛ approved=تأیید مدیر (قفل)';

-- Align existing manager-approved rows
UPDATE public.daily_reports
SET workflow_status = 'approved'
WHERE approved_by_manager = true
  AND workflow_status IS DISTINCT FROM 'approved';

CREATE INDEX IF NOT EXISTS idx_daily_reports_workflow
  ON public.daily_reports(project_id, workflow_status, report_date DESC);

SELECT 'daily_report_workflow ready' AS status;
