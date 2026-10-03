-- =====================================================
-- Package progress history — تاریخچهٔ پیشرفت بسته‌های کاری (append-only)
-- Run once in Supabase SQL Editor (or scripts/apply-package-progress-updates.py)
--
-- workshop_packages.schedule_fields.physical_percent_complete is overwritten on every
-- supervisor report. Each report also appends one row here, so the manager dashboard can
-- read a package's progress at any past moment (same role task_progress_updates plays for
-- project_tasks). Rows are never updated or deleted by the application.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.package_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.workshop_packages(id) ON DELETE CASCADE,
  progress_date DATE NOT NULL,
  percent_complete NUMERIC NOT NULL CHECK (percent_complete >= 0 AND percent_complete <= 100),
  entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_progress_updates_project_created
  ON public.package_progress_updates(project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_package_progress_updates_package_created
  ON public.package_progress_updates(package_id, created_at);

COMMENT ON TABLE public.package_progress_updates IS
  'تاریخچهٔ append-only درصد پیشرفت فیزیکی بسته‌های کاری؛ با هر ثبت پیشرفت سرپرست یک ردیف اضافه می‌شود.';
COMMENT ON COLUMN public.package_progress_updates.progress_date IS
  'تاریخ گزارش (میلادی) که پیشرفت برای آن ثبت شده است';
COMMENT ON COLUMN public.package_progress_updates.created_at IS
  'زمان دقیق ثبت؛ مقایسهٔ هم‌ساعت داشبورد مدیر با همین ستون انجام می‌شود';

ALTER TABLE public.package_progress_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_progress_updates_select ON public.package_progress_updates;
CREATE POLICY package_progress_updates_select ON public.package_progress_updates
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS package_progress_updates_insert ON public.package_progress_updates;
CREATE POLICY package_progress_updates_insert ON public.package_progress_updates
  FOR INSERT WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT ON public.package_progress_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_progress_updates TO service_role;

NOTIFY pgrst, 'reload schema';
