-- =====================================================
-- Milestone baseline + forecast history (بخش ۵)
-- Run once in Supabase SQL Editor after migration 73
-- =====================================================

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS milestone_baseline_date DATE;

COMMENT ON COLUMN public.project_tasks.milestone_baseline_date IS
  'تاریخ پایه مایلستون — فقط یک‌بار در اولین محاسبه CPM ست می‌شود و overwrite نمی‌شود';

CREATE TABLE IF NOT EXISTS public.milestone_forecast_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  predicted_date DATE NOT NULL,
  early_finish_days NUMERIC NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestone_forecast_project_task
  ON public.milestone_forecast_history(project_id, task_id, calculation_date ASC);

COMMENT ON TABLE public.milestone_forecast_history IS
  'روند تاریخ پیش‌بینی مایلستون در هر محاسبه CPM';

ALTER TABLE public.milestone_forecast_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS milestone_forecast_select ON public.milestone_forecast_history;
CREATE POLICY milestone_forecast_select ON public.milestone_forecast_history
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS milestone_forecast_write ON public.milestone_forecast_history;
CREATE POLICY milestone_forecast_write ON public.milestone_forecast_history
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

NOTIFY pgrst, 'reload schema';
