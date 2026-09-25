-- Hotfix: commercial + WBS columns required for schedule EDIT ↔ SEND ↔ صورت‌وضعیت sync.
-- Run once in Supabase SQL Editor if saves look successful but unit price / WBS do not persist.

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS wbs_code TEXT;

CREATE INDEX IF NOT EXISTS idx_workshop_packages_wbs_code
  ON public.workshop_packages(project_id, wbs_code);

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES public.project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS schedule_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workshop_packages_quantity_certainty_check'
  ) THEN
    ALTER TABLE public.workshop_packages
      ADD CONSTRAINT workshop_packages_quantity_certainty_check
      CHECK (quantity_certainty IN ('حدودی', 'قطعی'));
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END
$$;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی';

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 3);

COMMENT ON COLUMN public.project_tasks.quantity IS
  'Commercial quantity for schedule leaf activities (editable in ویرایش برنامه).';

NOTIFY pgrst, 'reload schema';
