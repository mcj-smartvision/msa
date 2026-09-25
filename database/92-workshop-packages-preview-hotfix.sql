-- Hotfix: columns often missing on older Supabase DBs that break ارسال برنامه.
-- Safe to re-run. Then reload PostgREST schema.

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS weight_percent NUMERIC;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS schedule_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS finish_date DATE;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS subcontractor_id UUID;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی';

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_workshop_packages_wbs_code
  ON public.workshop_packages(project_id, wbs_code);

NOTIFY pgrst, 'reload schema';
