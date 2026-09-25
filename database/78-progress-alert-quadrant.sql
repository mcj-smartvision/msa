-- =====================================================
-- Smart progress alerts — بخش ۲ (۲×۲ quadrants)
-- Run once in Supabase SQL Editor after migration 77
-- =====================================================

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS alert_quadrant TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_alert_quadrant_check'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_alert_quadrant_check
      CHECK (
        alert_quadrant IS NULL
        OR alert_quadrant IN ('urgent', 'normal_watch', 'soft_notice', 'no_display')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.project_tasks.alert_quadrant IS
  'هشدار هوشمند پیشرفت: urgent | normal_watch | soft_notice | no_display';

CREATE INDEX IF NOT EXISTS idx_project_tasks_alert_quadrant
  ON public.project_tasks(project_id, alert_quadrant)
  WHERE alert_quadrant IS NOT NULL;

-- Allow urgent combined alerts in schedule_alerts
ALTER TABLE public.schedule_alerts DROP CONSTRAINT IF EXISTS schedule_alerts_severity_check;

ALTER TABLE public.schedule_alerts
  ADD CONSTRAINT schedule_alerts_severity_check
  CHECK (severity IN (
    'negative',
    'critical',
    'near_critical',
    'fast_consumption',
    'urgent'
  ));

COMMENT ON COLUMN public.schedule_alerts.severity IS
  'float alerts + urgent (بحرانی/نزدیک‌بحرانی با نرخ پیشروی ضعیف)';

NOTIFY pgrst, 'reload schema';
