-- =====================================================
-- Earned monthly weight — وزن کسب‌شده هر فعالیت در هر ماه گزارش‌شده
-- Run once in Supabase SQL Editor after 93-progress-snapshots.sql
--
-- Independent of baseline_finish. Comes only from progress_snapshots.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.activity_earned_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  jalali_month TEXT NOT NULL,
  percent_this_month NUMERIC NOT NULL,
  percent_previous_month NUMERIC NOT NULL,
  earned_weight NUMERIC NOT NULL,
  physical_weight NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_earned_weights_unique UNIQUE (activity_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_activity_earned_weights_project_month
  ON public.activity_earned_weights(project_id, snapshot_month);

CREATE TABLE IF NOT EXISTS public.project_earned_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  jalali_month TEXT NOT NULL,
  earned_weight NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_earned_weights_unique UNIQUE (project_id, snapshot_month)
);

COMMENT ON TABLE public.activity_earned_weights IS
  'وزن کسب‌شده ماهانه از تفاضل درصد تجمعی progress_snapshots. به baseline_finish وابسته نیست.';
COMMENT ON TABLE public.project_earned_weights IS
  'جمع وزن کسب‌شده ماهانه کل پروژه (فقط فعالیت‌های غیرِ خلاصه).';

ALTER TABLE public.activity_earned_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_earned_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_earned_weights_select ON public.activity_earned_weights;
CREATE POLICY activity_earned_weights_select ON public.activity_earned_weights
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS activity_earned_weights_write ON public.activity_earned_weights;
CREATE POLICY activity_earned_weights_write ON public.activity_earned_weights
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_earned_weights_select ON public.project_earned_weights;
CREATE POLICY project_earned_weights_select ON public.project_earned_weights
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_earned_weights_write ON public.project_earned_weights;
CREATE POLICY project_earned_weights_write ON public.project_earned_weights
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_earned_weights TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_earned_weights TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
