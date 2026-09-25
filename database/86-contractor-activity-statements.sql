-- Commercial/progress values entered for schedule activities assigned to contractors.

CREATE TABLE IF NOT EXISTS public.contractor_activity_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.project_subcontractors(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'package')),
  entity_id UUID NOT NULL,
  estimated_qty NUMERIC(18, 3) NOT NULL DEFAULT 0 CHECK (estimated_qty >= 0),
  qty_kind TEXT NOT NULL DEFAULT 'حدودی' CHECK (qty_kind IN ('حدودی', 'قطعی')),
  uom TEXT NOT NULL DEFAULT 'm',
  unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  progress_percent NUMERIC(6, 2) NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, subcontractor_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_contractor_activity_statements_lookup
  ON public.contractor_activity_statements(project_id, subcontractor_id);

DROP TRIGGER IF EXISTS contractor_activity_statements_set_updated_at
  ON public.contractor_activity_statements;
CREATE TRIGGER contractor_activity_statements_set_updated_at
  BEFORE UPDATE ON public.contractor_activity_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contractor_activity_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contractor_activity_statements_all
  ON public.contractor_activity_statements;
CREATE POLICY contractor_activity_statements_all
  ON public.contractor_activity_statements
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.contractor_activity_statements TO authenticated;

NOTIFY pgrst, 'reload schema';
