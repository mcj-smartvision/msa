-- =====================================================
-- MSP schedule XML storage for re-download
-- Run after migration 64
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-schedules',
  'project-schedules',
  false,
  52428800,
  ARRAY[
    'text/xml',
    'application/xml',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.schedule_imports
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'project-schedules';

COMMENT ON COLUMN public.schedule_imports.storage_path IS 'Supabase storage path to original MSP XML';
COMMENT ON COLUMN public.schedule_imports.storage_bucket IS 'Storage bucket id for MSP XML file';

DROP POLICY IF EXISTS project_schedules_storage_read ON storage.objects;
CREATE POLICY project_schedules_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-schedules');

DROP POLICY IF EXISTS project_schedules_storage_insert ON storage.objects;
CREATE POLICY project_schedules_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-schedules');

DROP POLICY IF EXISTS project_schedules_storage_delete ON storage.objects;
CREATE POLICY project_schedules_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-schedules');

NOTIFY pgrst, 'reload schema';
