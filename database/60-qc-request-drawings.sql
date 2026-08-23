CREATE TABLE IF NOT EXISTS qc_engine.inspection_request_drawing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES qc_engine.inspection_request(id) ON DELETE CASCADE,
  source_drawing_id TEXT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON qc_engine.inspection_request_drawing TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
