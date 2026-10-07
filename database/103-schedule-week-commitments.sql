-- =====================================================
-- Weekly schedule commitments — تعهدات منجمد هر هفته (PPC)
-- Run once in Supabase SQL Editor, on the development database only.
--
-- start_current / finish_current now follow the reported progress (automatic forecast).
-- The first time a week is touched (Saturday morning or the first report of that week) the
-- current window of every daily-report activity is frozen here; PPC and the blue "required"
-- numbers of the daily report read the frozen window of their week, so a delay that pushes
-- the forecast does not lower that week's commitment. Rows are never updated or deleted.
-- activity_id: 'schedule:<project_tasks.id>' or 'package:<workshop_packages.id>'.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.schedule_week_commitments (
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start  date        NOT NULL,
  activity_id text        NOT NULL,
  start_date  date        NOT NULL,
  finish_date date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, week_start, activity_id)
);

ALTER TABLE public.schedule_week_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_week_commitments_select ON public.schedule_week_commitments;
CREATE POLICY schedule_week_commitments_select ON public.schedule_week_commitments
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_week_commitments_insert ON public.schedule_week_commitments;
CREATE POLICY schedule_week_commitments_insert ON public.schedule_week_commitments
  FOR INSERT WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT ON public.schedule_week_commitments TO authenticated;

COMMENT ON TABLE public.schedule_week_commitments IS
  'پنجرهٔ زمانی منجمد هر فعالیت در شروع هر هفته (شنبه)؛ تعهد آن هفته برای PPC و درصد لازم گزارش روزانه.';

NOTIFY pgrst, 'reload schema';
