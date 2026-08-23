ALTER TABLE qc_engine.inspection_request
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS grid_from TEXT,
  ADD COLUMN IF NOT EXISTS grid_to TEXT,
  ADD COLUMN IF NOT EXISTS source_drawing_id TEXT;

NOTIFY pgrst, 'reload schema';
