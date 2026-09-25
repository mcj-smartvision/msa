-- =====================================================
-- Progress Pace (نرخ پیشروی) — هشدار هوشمند پیشرفت بخش ۱
-- Columns live on project_tasks (app schedule activity table).
-- Run once in Supabase SQL Editor
-- =====================================================

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS pace_ratio NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS pace_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_pace_status_check'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_pace_status_check
      CHECK (
        pace_status IS NULL
        OR pace_status IN ('good', 'warning', 'bad')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.project_tasks.pace_ratio IS
  'physical_percent_complete ÷ expected_percent (از actual_start تا status_date)';
COMMENT ON COLUMN public.project_tasks.pace_status IS
  'good (>=0.9) | warning (0.6–0.9) | bad (<0.6) | null اگر خارج از در-حال-اجرا';

CREATE INDEX IF NOT EXISTS idx_project_tasks_pace_status
  ON public.project_tasks(project_id, pace_status)
  WHERE pace_status IS NOT NULL;

NOTIFY pgrst, 'reload schema';
