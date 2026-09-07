-- =====================================================
-- CPM calculation persistence (بخش ۲)
-- Run once in Supabase SQL Editor after migration 71
-- =====================================================

-- Latest CPM snapshot per task (upsert)
CREATE TABLE IF NOT EXISTS public.schedule_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  early_start NUMERIC NOT NULL DEFAULT 0,
  early_finish NUMERIC NOT NULL DEFAULT 0,
  late_start NUMERIC NOT NULL DEFAULT 0,
  late_finish NUMERIC NOT NULL DEFAULT 0,
  total_float NUMERIC NOT NULL DEFAULT 0,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  project_duration_days NUMERIC NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_calculations_unique UNIQUE (project_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_calculations_project
  ON public.schedule_calculations(project_id);

CREATE INDEX IF NOT EXISTS idx_schedule_calculations_critical
  ON public.schedule_calculations(project_id, is_critical)
  WHERE is_critical = true;

COMMENT ON TABLE public.schedule_calculations IS 'آخرین نتیجه CPM هر فعالیت (روز نسبی از شروع شبکه)';
COMMENT ON COLUMN public.schedule_calculations.early_start IS 'ES به روز از مبدأ CPM (روز ۰)';
COMMENT ON COLUMN public.schedule_calculations.total_float IS 'شناوری کل = LS - ES (روز)';

-- Historical float samples (insert every run)
CREATE TABLE IF NOT EXISTS public.float_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  early_start NUMERIC NOT NULL DEFAULT 0,
  early_finish NUMERIC NOT NULL DEFAULT 0,
  late_start NUMERIC NOT NULL DEFAULT 0,
  late_finish NUMERIC NOT NULL DEFAULT 0,
  total_float NUMERIC NOT NULL DEFAULT 0,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  project_duration_days NUMERIC NOT NULL DEFAULT 0,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_float_history_project_date
  ON public.float_history(project_id, calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_float_history_task
  ON public.float_history(task_id, calculated_at DESC);

COMMENT ON TABLE public.float_history IS 'روند شناوری در طول زمان — هر محاسبه یک ردیف جدید';

ALTER TABLE public.schedule_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_calculations_select ON public.schedule_calculations;
CREATE POLICY schedule_calculations_select ON public.schedule_calculations
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_calculations_write ON public.schedule_calculations;
CREATE POLICY schedule_calculations_write ON public.schedule_calculations
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS float_history_select ON public.float_history;
CREATE POLICY float_history_select ON public.float_history
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS float_history_write ON public.float_history;
CREATE POLICY float_history_write ON public.float_history
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

NOTIFY pgrst, 'reload schema';
