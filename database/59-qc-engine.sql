CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS qc_engine;

CREATE TABLE IF NOT EXISTS qc_engine.inspectable_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  discipline_key TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  element_type_key TEXT NOT NULL,
  floor TEXT,
  grid_ref TEXT,
  grid_x TEXT,
  grid_y TEXT,
  location_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);

CREATE TABLE IF NOT EXISTS qc_engine.inspection_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  activity_type TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','scheduled','in_progress','completed','cancelled')),
  assigned_inspector_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qc_engine.inspection_request_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES qc_engine.inspection_request(id) ON DELETE CASCADE,
  inspectable_item_id UUID NOT NULL
    REFERENCES qc_engine.inspectable_item(id),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (request_id, inspectable_item_id)
);

CREATE TABLE IF NOT EXISTS qc_engine.checklist_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_key TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  element_type_key TEXT NOT NULL,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (discipline_key, topic_key, element_type_key, version)
);

CREATE TABLE IF NOT EXISTS qc_engine.checklist_template_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL
    REFERENCES qc_engine.checklist_template(id) ON DELETE CASCADE,
  code TEXT,
  prompt TEXT NOT NULL,
  sort_order INT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  allow_na BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (template_id, sort_order)
);

CREATE TABLE IF NOT EXISTS qc_engine.inspection_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL
    REFERENCES qc_engine.inspection_request(id) ON DELETE CASCADE,
  inspectable_item_id UUID NOT NULL
    REFERENCES qc_engine.inspectable_item(id),
  template_item_id UUID NOT NULL
    REFERENCES qc_engine.checklist_template_item(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('pass','fail','na')),
  notes TEXT,
  inspector_id UUID NOT NULL,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, inspectable_item_id, template_item_id)
);

CREATE TABLE IF NOT EXISTS qc_engine.inspection_result_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL
    REFERENCES qc_engine.inspection_result(id) ON DELETE CASCADE,
  storage_ref TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS qc_engine.ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  ncr_number TEXT NOT NULL,
  inspection_result_id UUID NOT NULL
    REFERENCES qc_engine.inspection_result(id),
  inspectable_item_id UUID NOT NULL
    REFERENCES qc_engine.inspectable_item(id),
  severity TEXT NOT NULL CHECK (severity IN ('minor','major','critical')),
  root_cause_category TEXT NOT NULL
    CHECK (root_cause_category IN (
      'material','workmanship','design','procedure','environment','other'
    )),
  root_cause_note TEXT,
  corrective_action TEXT,
  corrective_action_owner_id UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','pending_verify','closed','waived')),
  opened_by UUID,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, ncr_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS ncr_one_open_per_result
  ON qc_engine.ncr (inspection_result_id)
  WHERE status NOT IN ('closed','waived');

CREATE TABLE IF NOT EXISTS qc_engine.role_permission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key TEXT NOT NULL
    CHECK (role_key IN (
      'supervisor','inspector','contractor_pm','client_pm','consultant'
    )),
  resource TEXT NOT NULL
    CHECK (resource IN (
      'inspectable_item','inspection_request','checklist_template',
      'inspection_result','ncr'
    )),
  can_read BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_update BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_transition BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (role_key, resource)
);

GRANT USAGE ON SCHEMA qc_engine TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA qc_engine TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA qc_engine TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA qc_engine GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA qc_engine GRANT ALL ON TABLES TO service_role;

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, storage, graphql_public, qc_engine';
NOTIFY pgrst, 'reload schema';
