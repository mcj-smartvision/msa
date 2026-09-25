-- =====================================================
-- Planned / Earned month progress and overhead allocation
-- Run once in Supabase SQL Editor after 96-monthly-project-progress.sql
--
-- Progress fractions are 0–1 (snapshot percent ÷ 100).
-- planned_weight_month = weight_factor × planned_monthly_progress
-- earned_weight_month  = weight_factor × actual_monthly_progress
-- Overhead is split by those weights. Actual falls back to the planned
-- split when the month's earned total is 0.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_monthly_overhead (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  monthly_overhead_cost NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, month)
);

COMMENT ON TABLE public.project_monthly_overhead IS
  'هزینه بالاسری ثبت‌شده برای هر ماه شمسی. month روز اول ماه به تاریخ میلادی است.';

CREATE TABLE IF NOT EXISTS public.activity_month_allocations (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  weight_factor NUMERIC NOT NULL,
  cumulative_planned_progress NUMERIC NOT NULL,
  planned_monthly_progress NUMERIC NOT NULL,
  planned_weight_month NUMERIC NOT NULL,
  cumulative_actual_progress NUMERIC NOT NULL,
  actual_monthly_progress NUMERIC NOT NULL,
  earned_weight_month NUMERIC NOT NULL,
  monthly_overhead_cost NUMERIC NOT NULL,
  planned_activity_overhead NUMERIC NOT NULL,
  actual_activity_overhead NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, month)
);

CREATE INDEX IF NOT EXISTS idx_activity_month_allocations_project
  ON public.activity_month_allocations(project_id, month);

COMMENT ON TABLE public.activity_month_allocations IS
  'پیشرفت و وزن ماهانه Planned/Earned و سهم بالاسری هر فعالیت غیرخلاصه.';

ALTER TABLE public.monthly_project_progress
  ADD COLUMN IF NOT EXISTS monthly_overhead_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS planned_overhead NUMERIC,
  ADD COLUMN IF NOT EXISTS actual_overhead NUMERIC;

COMMENT ON COLUMN public.monthly_project_progress.monthly_overhead_cost IS
  'هزینه بالاسری همان ماه';
COMMENT ON COLUMN public.monthly_project_progress.planned_overhead IS
  'جمع بالاسری برنامه‌ای فعالیت‌ها؛ برابر هزینه ماه وقتی وزن برنامه‌ای وجود دارد';
COMMENT ON COLUMN public.monthly_project_progress.actual_overhead IS
  'جمع بالاسری واقعی؛ اگر Earned ماه صفر باشد با توزیع برنامه‌ای پر می‌شود';

ALTER TABLE public.project_monthly_overhead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_month_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_monthly_overhead_select ON public.project_monthly_overhead;
CREATE POLICY project_monthly_overhead_select ON public.project_monthly_overhead
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_monthly_overhead_write ON public.project_monthly_overhead;
CREATE POLICY project_monthly_overhead_write ON public.project_monthly_overhead
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS activity_month_allocations_select ON public.activity_month_allocations;
CREATE POLICY activity_month_allocations_select ON public.activity_month_allocations
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS activity_month_allocations_write ON public.activity_month_allocations;
CREATE POLICY activity_month_allocations_write ON public.activity_month_allocations
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_monthly_overhead TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_month_allocations TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
