-- =====================================================
-- Schedule data prerequisites (بخش ۱)
-- Run once in Supabase SQL Editor after migration 70
--
-- Activities live in public.project_tasks (not a separate "activities" table).
-- Dependencies already exist as public.task_dependencies — do NOT create a
-- second "dependencies" table (app + MSP import already use task_dependencies).
-- =====================================================

-- -----------------------------------------------------
-- project_tasks: duration / WBS parent / milestone
-- -----------------------------------------------------

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS duration_days INTEGER;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_tasks.duration_days IS 'مدت فعالیت به روز (از MSP Duration یا اختلاف تاریخ)';
COMMENT ON COLUMN public.project_tasks.parent_id IS 'سرشاخه والد WBS — برای درخت expand/collapse';
COMMENT ON COLUMN public.project_tasks.is_milestone IS 'مایلستون MSP (Milestone=1 یا مدت صفر)';

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_id
  ON public.project_tasks(parent_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone
  ON public.project_tasks(project_id, is_milestone)
  WHERE is_milestone = true;

-- No self-parent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_tasks_parent_not_self'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_parent_not_self
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

-- Backfill duration_days from planned dates when missing
UPDATE public.project_tasks
SET duration_days = GREATEST(
  0,
  CEIL(EXTRACT(EPOCH FROM (finish_planned - start_planned)) / 86400.0)::integer
)
WHERE duration_days IS NULL
  AND start_planned IS NOT NULL
  AND finish_planned IS NOT NULL;

-- Treat zero-duration non-summary rows as milestones when flag still default
UPDATE public.project_tasks
SET is_milestone = true
WHERE is_milestone = false
  AND COALESCE(is_summary, false) = false
  AND duration_days = 0;

-- Backfill parent_id from WBS outline (e.g. 1.2.3 → parent wbs 1.2)
UPDATE public.project_tasks AS child
SET parent_id = parent.id
FROM public.project_tasks AS parent
WHERE child.parent_id IS NULL
  AND child.project_id = parent.project_id
  AND child.wbs_code IS NOT NULL
  AND parent.wbs_code IS NOT NULL
  AND child.wbs_code LIKE parent.wbs_code || '.%'
  AND position('.' in substr(child.wbs_code, length(parent.wbs_code) + 2)) = 0;

-- -----------------------------------------------------
-- task_dependencies already covers FS/SS/FF/SF + lag
-- Mapping vs requested names:
--   predecessor_id  → predecessor_task_id
--   successor_id    → successor_task_id
--   type            → relation_type  ('FS'|'SS'|'FF'|'SF')
--   lag_days        → lag_duration   (minutes; MSP LinkLag/10)
--                     days ≈ round(lag_duration / 480) for 8h calendar
-- -----------------------------------------------------

COMMENT ON COLUMN public.task_dependencies.lag_duration IS
  'تأخیر پیوند به دقیقه (MSP LinkLag÷10). برای نمایش روز: round(lag_duration/480)';

NOTIFY pgrst, 'reload schema';
