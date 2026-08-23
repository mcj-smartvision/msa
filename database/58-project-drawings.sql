-- =====================================================
-- Technical office drawings (PDF) for site supervisor
-- Run after migration 57
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-drawings',
  'project-drawings',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/json',
    'application/acad',
    'application/x-acad',
    'application/dwg',
    'application/x-dwg',
    'application/x-autocad',
    'image/vnd.dwg',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.project_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_drawings_project
  ON public.project_drawings (project_id, created_at DESC);

ALTER TABLE public.project_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_drawings_select ON public.project_drawings;
CREATE POLICY project_drawings_select ON public.project_drawings
  FOR SELECT TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS project_drawings_insert ON public.project_drawings;
CREATE POLICY project_drawings_insert ON public.project_drawings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS project_drawings_delete ON public.project_drawings;
CREATE POLICY project_drawings_delete ON public.project_drawings
  FOR DELETE TO authenticated
  USING (public.is_system_admin() OR uploaded_by = auth.uid());

DROP POLICY IF EXISTS project_drawings_storage_read ON storage.objects;
CREATE POLICY project_drawings_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-drawings');

DROP POLICY IF EXISTS project_drawings_storage_insert ON storage.objects;
CREATE POLICY project_drawings_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-drawings');

DROP POLICY IF EXISTS project_drawings_storage_delete ON storage.objects;
CREATE POLICY project_drawings_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-drawings');

NOTIFY pgrst, 'reload schema';
