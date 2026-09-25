-- Full schedule-column values and contractor inheritance for user-added sub-branches.

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS subcontractor_id UUID
  REFERENCES public.project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS schedule_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workshop_packages_subcontractor
  ON public.workshop_packages(project_id, subcontractor_id)
  WHERE subcontractor_id IS NOT NULL;

COMMENT ON COLUMN public.workshop_packages.subcontractor_id IS
  'Direct contractor override; NULL inherits from parent package or project task.';
COMMENT ON COLUMN public.workshop_packages.schedule_fields IS
  'Editable schedule-column values for user-added sub-branches.';
