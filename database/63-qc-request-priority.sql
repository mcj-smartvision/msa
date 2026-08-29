ALTER TABLE qc_engine.inspection_request
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

NOTIFY pgrst, 'reload schema';
