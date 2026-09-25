-- =====================================================
-- Site overhead workbook (accountant matrix) on the database
-- Run once in Supabase SQL Editor after 97-month-progress-overhead.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_overhead_workbooks (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  month_labels TEXT[] NOT NULL DEFAULT '{}',
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  customized BOOLEAN NOT NULL DEFAULT true,
  saved_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_overhead_workbooks IS
  'ماتریس هزینه بالاسری کارگاه: سرفصل‌ها و مبلغ هر ماه، به‌ازای هر پروژه.';

ALTER TABLE public.project_overhead_workbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_overhead_workbooks_select ON public.project_overhead_workbooks;
CREATE POLICY project_overhead_workbooks_select ON public.project_overhead_workbooks
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_overhead_workbooks_write ON public.project_overhead_workbooks;
CREATE POLICY project_overhead_workbooks_write ON public.project_overhead_workbooks
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_overhead_workbooks TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
