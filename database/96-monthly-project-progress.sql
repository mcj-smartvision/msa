-- =====================================================
-- Monthly project progress — تجمیع Planned / Earned برای S-Curve
-- Run once in Supabase SQL Editor after 94 and 95
--
-- month is the Gregorian date of day 1 of the Jalali month.
-- Rows cover every Jalali month from project start through today.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.monthly_project_progress (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  planned_weight NUMERIC,
  earned_weight NUMERIC,
  planned_cumulative NUMERIC,
  earned_cumulative NUMERIC,
  PRIMARY KEY (project_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_project_progress_month
  ON public.monthly_project_progress(project_id, month);

COMMENT ON TABLE public.monthly_project_progress IS
  'جمع ماهانه و تجمعی وزن طراحی‌شده و کسب‌شده کل پروژه برای S-Curve. فقط فعالیت‌های غیرخلاصه.';
COMMENT ON COLUMN public.monthly_project_progress.month IS
  'روز اول ماه شمسی به تاریخ میلادی';
COMMENT ON COLUMN public.monthly_project_progress.planned_cumulative IS
  'جمع تجمعی Planned تا این ماه';
COMMENT ON COLUMN public.monthly_project_progress.earned_cumulative IS
  'جمع تجمعی Earned تا این ماه؛ تا قبل از اولین گزارش null است';

ALTER TABLE public.monthly_project_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_project_progress_select ON public.monthly_project_progress;
CREATE POLICY monthly_project_progress_select ON public.monthly_project_progress
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS monthly_project_progress_write ON public.monthly_project_progress;
CREATE POLICY monthly_project_progress_write ON public.monthly_project_progress
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_project_progress TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
