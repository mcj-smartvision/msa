-- =====================================================
-- Progress snapshots — تاریخچهٔ درصد پیشرفت فیزیکی در پایان هر ماه شمسی
-- Run once in Supabase SQL Editor
--
-- schedule_activities is a VIEW over project_tasks, so the foreign key
-- points at project_tasks(id). snapshot_month is the Gregorian date of
-- day 1 of that Jalali month (PostgreSQL DATE is Gregorian).
-- jalali_month keeps the requested label, e.g. 1405-05-01.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  jalali_month TEXT NOT NULL,
  cumulative_percent NUMERIC NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT progress_snapshots_activity_month_unique UNIQUE (activity_id, snapshot_month),
  CONSTRAINT progress_snapshots_percent_check
    CHECK (cumulative_percent >= 0 AND cumulative_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_project_month
  ON public.progress_snapshots(project_id, snapshot_month);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_jalali
  ON public.progress_snapshots(project_id, jalali_month);

COMMENT ON TABLE public.progress_snapshots IS
  'درصد پیشرفت فیزیکی تجمعی هر فعالیت در پایان ماه شمسی. تاریخچه از روز شروع ثبت نگه داشته می‌شود؛ ماه‌های قبل Earned ندارند.';
COMMENT ON COLUMN public.progress_snapshots.snapshot_month IS
  'روز اول ماه شمسی به تاریخ میلادی';
COMMENT ON COLUMN public.progress_snapshots.jalali_month IS
  'برچسب ماه شمسی، همیشه روز اول، مثلاً 1405-05-01';
COMMENT ON COLUMN public.progress_snapshots.cumulative_percent IS
  'physical_percent_complete تجمعی در زمان ثبت اسنپ‌شات';

ALTER TABLE public.progress_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_snapshots_select ON public.progress_snapshots;
CREATE POLICY progress_snapshots_select ON public.progress_snapshots
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS progress_snapshots_write ON public.progress_snapshots;
CREATE POLICY progress_snapshots_write ON public.progress_snapshots
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_snapshots TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
