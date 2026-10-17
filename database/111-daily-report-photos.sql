-- =====================================================
-- Daily report photos — linked to daily_reports (id + report_no + date)
-- Run once in Supabase SQL Editor.
-- =====================================================

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS report_no TEXT;

COMMENT ON COLUMN public.daily_reports.report_no IS
  'شمارهٔ خوانا برای گزارش روزانه (مثلاً DR-14040525-A1B2C3D4)';

CREATE TABLE IF NOT EXISTS public.daily_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'daily-reports',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  byte_size BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_report_photos_path_unique UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_daily_report_photos_report
  ON public.daily_report_photos(daily_report_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_project_date
  ON public.daily_report_photos(project_id, report_date DESC);

ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_report_photos_select ON public.daily_report_photos;
CREATE POLICY daily_report_photos_select ON public.daily_report_photos
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS daily_report_photos_insert ON public.daily_report_photos;
CREATE POLICY daily_report_photos_insert ON public.daily_report_photos
  FOR INSERT WITH CHECK (
    (public.is_project_member(project_id) OR public.is_system_admin())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS daily_report_photos_delete ON public.daily_report_photos;
CREATE POLICY daily_report_photos_delete ON public.daily_report_photos
  FOR DELETE USING (
    public.is_system_admin()
    OR (
      public.is_project_member(project_id)
      AND created_by = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-reports', 'daily-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS daily_reports_storage_select ON storage.objects;
CREATE POLICY daily_reports_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'daily-reports'
    AND (
      public.is_system_admin()
      OR public.is_project_member((storage.foldername(name))[1]::uuid)
    )
  );

DROP POLICY IF EXISTS daily_reports_storage_insert ON storage.objects;
CREATE POLICY daily_reports_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'daily-reports'
    AND auth.role() = 'authenticated'
    AND (
      public.is_system_admin()
      OR public.is_project_member((storage.foldername(name))[1]::uuid)
    )
  );

DROP POLICY IF EXISTS daily_reports_storage_delete ON storage.objects;
CREATE POLICY daily_reports_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'daily-reports'
    AND (
      public.is_system_admin()
      OR public.is_project_member((storage.foldername(name))[1]::uuid)
    )
  );

SELECT 'daily_report_photos ready' AS status;
