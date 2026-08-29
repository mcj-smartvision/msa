ALTER TABLE qc_engine.inspection_request
  ADD COLUMN IF NOT EXISTS inspector_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspector_classified TEXT,
  ADD COLUMN IF NOT EXISTS inspector_verdict TEXT;

NOTIFY pgrst, 'reload schema';
