-- =====================================================
-- Planned monthly weight — وزن طراحی‌شده هر فعالیت در هر ماه شمسی
-- Run once in Supabase SQL Editor after 93-progress-snapshots.sql
--
-- Computed from baseline_start/baseline_finish and physical_weight.
-- Recomputed only when that baseline signature changes.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.activity_planned_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  jalali_month TEXT NOT NULL,
  planned_weight NUMERIC NOT NULL,
  overlap_days INTEGER NOT NULL,
  baseline_start DATE,
  baseline_finish DATE,
  physical_weight NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT activity_planned_weights_unique UNIQUE (activity_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_activity_planned_weights_project_month
  ON public.activity_planned_weights(project_id, snapshot_month);

CREATE TABLE IF NOT EXISTS public.project_planned_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  jalali_month TEXT NOT NULL,
  planned_weight NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_planned_weights_unique UNIQUE (project_id, snapshot_month)
);

COMMENT ON TABLE public.activity_planned_weights IS
  'وزن طراحی‌شده ماهانه از Baseline. فقط با تغییر رسمی Baseline یا وزن دوباره محاسبه می‌شود.';
COMMENT ON TABLE public.project_planned_weights IS
  'جمع وزن طراحی‌شده ماهانه کل پروژه (فقط فعالیت‌های غیرِ خلاصه، بدون دوباره‌شماری سرشاخه).';

ALTER TABLE public.activity_planned_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_planned_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_planned_weights_select ON public.activity_planned_weights;
CREATE POLICY activity_planned_weights_select ON public.activity_planned_weights
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS activity_planned_weights_write ON public.activity_planned_weights;
CREATE POLICY activity_planned_weights_write ON public.activity_planned_weights
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_planned_weights_select ON public.project_planned_weights;
CREATE POLICY project_planned_weights_select ON public.project_planned_weights
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_planned_weights_write ON public.project_planned_weights;
CREATE POLICY project_planned_weights_write ON public.project_planned_weights
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_planned_weights TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_planned_weights TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
