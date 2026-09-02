-- MSP summary / WBS group rows (زیرشاخه‌های برنامه)
-- Run after migration 66 (schedule_weight)

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS is_summary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_tasks.is_summary IS 'ردیف خلاصه MSP (Summary=1) — زیرشاخه WBS، بدون بسته کارگاه';

CREATE INDEX IF NOT EXISTS idx_project_tasks_summary
  ON public.project_tasks(project_id, is_summary);

NOTIFY pgrst, 'reload schema';
