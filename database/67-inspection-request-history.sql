-- Audit trail for inspection requests (rejection / re-inspection cycles)
ALTER TABLE qc_engine.inspection_request
  ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reinspect_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS qc_engine.inspection_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES qc_engine.inspection_request(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('submitted', 'rejected', 'approved', 'resubmitted')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  activity_type TEXT,
  floor TEXT,
  grid_from TEXT,
  grid_to TEXT,
  request_notes TEXT,
  inspector_notes TEXT,
  inspector_classified TEXT,
  item_codes TEXT[],
  cycle_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_request_history_request
  ON qc_engine.inspection_request_history(request_id, occurred_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON qc_engine.inspection_request_history TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
