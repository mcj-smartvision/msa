-- Run once in Supabase SQL Editor (schedule weight + WBS summary rows + package weight %)

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS schedule_weight NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS is_summary BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS weight_percent NUMERIC;

CREATE INDEX IF NOT EXISTS idx_project_tasks_summary
  ON public.project_tasks(project_id, is_summary);

COMMENT ON COLUMN public.project_tasks.schedule_weight IS 'وزن فعالیت از MSP';
COMMENT ON COLUMN public.project_tasks.is_summary IS 'ردیف خلاصه MSP (زیرشاخه WBS)';
COMMENT ON COLUMN public.workshop_packages.weight_percent IS 'سهم وزن زیرشاخه از ۱۰۰ نسبت به والد';

NOTIFY pgrst, 'reload schema';
