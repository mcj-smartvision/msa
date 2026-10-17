-- =====================================================
-- Open draft + multi submit per day
-- Run once in Supabase SQL Editor (after 112).
-- - Drop one-row-per-day unique
-- - At most one open draft per supervisor+project
-- - Finalized (not sent) becomes editable draft again
-- =====================================================

ALTER TABLE public.daily_reports
  DROP CONSTRAINT IF EXISTS daily_reports_unique_day;

-- If several open rows exist, keep the newest as draft and archive the rest as submitted
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, site_supervisor_id
      ORDER BY COALESCE(finalized_at, submitted_to_manager_at, approved_at) DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.daily_reports
  WHERE workflow_status IN ('draft', 'finalized')
    AND COALESCE(approved_by_manager, false) = false
)
UPDATE public.daily_reports d
SET
  workflow_status = 'submitted',
  submitted_to_manager_at = COALESCE(d.submitted_to_manager_at, NOW()),
  finalized_at = COALESCE(d.finalized_at, NOW())
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

UPDATE public.daily_reports
SET workflow_status = 'draft'
WHERE workflow_status = 'finalized'
  AND COALESCE(approved_by_manager, false) = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_reports_one_open_draft
  ON public.daily_reports (project_id, site_supervisor_id)
  WHERE workflow_status = 'draft';

COMMENT ON INDEX public.uq_daily_reports_one_open_draft IS
  'Only one open (editable) draft per project + site supervisor; submitted rows may share report_date';

SELECT 'daily_report_open_draft ready' AS status;
