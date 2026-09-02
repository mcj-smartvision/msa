-- Persist workshop package WBS codes (e.g. 4.6.1 under parent 4.6)
-- Run after migration 48

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

CREATE INDEX IF NOT EXISTS idx_workshop_packages_wbs_code
  ON public.workshop_packages(project_id, wbs_code);
