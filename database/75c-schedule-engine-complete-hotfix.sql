-- =====================================================
-- HOTFIX 75c — complete schema after partial 75 / 75b failure
-- Errors seen:
--   42809 schedule_activities is not a view
--   42703 column t.external_id does not exist
--
-- Safe to re-run. Adds missing columns, then creates views + RLS.
-- =====================================================

-- -----------------------------------------------------
-- 1) Ensure project_tasks columns exist
-- -----------------------------------------------------

ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS outline_number TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS outline_level INT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS obs_code TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS cbs_code TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS remaining_duration_days NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS calendar_id UUID;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS constraint_type TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS constraint_date TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS baseline_duration_days NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS baseline_cost NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS baseline_work_hours NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS physical_percent_complete NUMERIC DEFAULT 0;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS actual_finish TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS actual_duration_days NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS status_date TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS work_hours NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS fixed_cost NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS physical_weight NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS planned_value NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS earned_value NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS actual_cost NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS flag BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS priority INT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS is_manual_scheduled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS has_split BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS is_recurring_master BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS total_float_days NUMERIC;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS free_float_days NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_constraint_type_chk'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_constraint_type_chk
      CHECK (
        constraint_type IS NULL
        OR constraint_type IN ('ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_physical_pct_chk'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_physical_pct_chk
      CHECK (
        physical_percent_complete IS NULL
        OR (physical_percent_complete >= 0 AND physical_percent_complete <= 100)
      );
  END IF;
END $$;

-- Generated column (drop/recreate if missing or wrong)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_tasks'
      AND column_name = 'earned_weighted_progress'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD COLUMN earned_weighted_progress NUMERIC
      GENERATED ALWAYS AS (
        COALESCE(physical_weight, 0) * COALESCE(physical_percent_complete, 0) / 100.0
      ) STORED;
  END IF;
END $$;

UPDATE public.project_tasks
SET external_id = COALESCE(external_id, msp_uid::text)
WHERE external_id IS NULL AND msp_uid IS NOT NULL;

UPDATE public.project_tasks
SET physical_weight = COALESCE(physical_weight, schedule_weight)
WHERE physical_weight IS NULL AND schedule_weight IS NOT NULL;

UPDATE public.project_tasks
SET physical_percent_complete = percent_complete
WHERE (physical_percent_complete IS NULL OR physical_percent_complete = 0)
  AND percent_complete IS NOT NULL;

-- -----------------------------------------------------
-- 2) task_dependencies lag fields
-- -----------------------------------------------------

ALTER TABLE public.task_dependencies ADD COLUMN IF NOT EXISTS lag_days NUMERIC;
ALTER TABLE public.task_dependencies ADD COLUMN IF NOT EXISTS lag_is_percentage BOOLEAN NOT NULL DEFAULT false;

UPDATE public.task_dependencies
SET lag_days = ROUND((lag_duration::numeric / 480.0), 4)
WHERE lag_days IS NULL;

-- -----------------------------------------------------
-- 3) free_float on CPM tables
-- -----------------------------------------------------

ALTER TABLE public.schedule_calculations ADD COLUMN IF NOT EXISTS free_float NUMERIC;
ALTER TABLE public.float_history ADD COLUMN IF NOT EXISTS free_float NUMERIC;

-- -----------------------------------------------------
-- 4) New tables (IF NOT EXISTS)
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.schedule_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  working_days JSONB NOT NULL DEFAULT '{"saturday":true,"sunday":true,"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":false}'::jsonb,
  daily_shifts JSONB NOT NULL DEFAULT '[{"start":"08:00","end":"12:00"},{"start":"13:00","end":"17:00"}]'::jsonb,
  exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  minutes_per_day NUMERIC NOT NULL DEFAULT 480,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_calendars_project
  ON public.schedule_calendars(project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_calendar_id_fkey'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_calendar_id_fkey
      FOREIGN KEY (calendar_id) REFERENCES public.schedule_calendars(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.schedule_task_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  segment_start TIMESTAMPTZ NOT NULL,
  segment_finish TIMESTAMPTZ NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_task_segments_range_chk CHECK (segment_finish >= segment_start)
);

CREATE INDEX IF NOT EXISTS idx_schedule_task_segments_activity
  ON public.schedule_task_segments(activity_id, sort_order);

CREATE TABLE IF NOT EXISTS public.schedule_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'work' CHECK (type IN ('work', 'material', 'cost')),
  standard_rate NUMERIC,
  unit_of_measure TEXT,
  max_units NUMERIC,
  calendar_id UUID REFERENCES public.schedule_calendars(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_resources_project
  ON public.schedule_resources(project_id);

CREATE TABLE IF NOT EXISTS public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.schedule_resources(id) ON DELETE CASCADE,
  units_percent NUMERIC,
  work_hours NUMERIC,
  cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_assignments_unique UNIQUE (activity_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_assignments_activity
  ON public.schedule_assignments(activity_id);

CREATE INDEX IF NOT EXISTS idx_schedule_assignments_resource
  ON public.schedule_assignments(resource_id);

-- -----------------------------------------------------
-- 5) Replace legacy TABLES with compatibility VIEWS
-- -----------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_activities' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.schedule_activities RENAME TO schedule_activities_legacy_backup;
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_activities' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.schedule_activities;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_dependencies' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.schedule_dependencies RENAME TO schedule_dependencies_legacy_backup;
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_dependencies' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.schedule_dependencies;
  END IF;
END $$;

CREATE VIEW public.schedule_activities AS
SELECT
  t.id,
  t.project_id,
  COALESCE(t.external_id, t.msp_uid::text) AS external_id,
  t.wbs_code,
  t.outline_number,
  t.outline_level,
  t.parent_id,
  t.name,
  COALESCE(t.is_summary, false) AS is_summary,
  COALESCE(t.is_milestone, false) AS is_milestone,
  t.obs_code,
  t.cbs_code,
  t.duration_days::numeric AS duration_days,
  t.remaining_duration_days,
  t.start_planned AS planned_start,
  t.finish_planned AS planned_finish,
  t.calendar_id,
  t.constraint_type,
  t.constraint_date,
  t.deadline,
  COALESCE(t.total_float_days, sc.total_float) AS total_float_days,
  COALESCE(t.free_float_days, sc.free_float) AS free_float_days,
  COALESCE(sc.is_critical, t.is_critical) AS is_critical,
  t.baseline_start,
  t.baseline_finish,
  t.baseline_duration_days,
  t.baseline_cost,
  t.baseline_work_hours,
  t.percent_complete,
  COALESCE(t.physical_percent_complete, t.percent_complete) AS physical_percent_complete,
  t.actual_start,
  t.actual_finish,
  t.actual_duration_days,
  t.status_date,
  t.work_hours,
  t.cost,
  t.fixed_cost,
  COALESCE(t.physical_weight, t.schedule_weight) AS physical_weight,
  t.earned_weighted_progress,
  t.planned_value,
  t.earned_value,
  t.actual_cost,
  t.notes,
  t.flag,
  t.priority,
  t.is_manual_scheduled,
  t.has_split,
  t.is_recurring_master,
  t.source_file,
  t.imported_at,
  t.created_at,
  t.updated_at
FROM public.project_tasks t
LEFT JOIN public.schedule_calculations sc
  ON sc.task_id = t.id AND sc.project_id = t.project_id;

COMMENT ON VIEW public.schedule_activities IS
  'Compatibility view — canonical storage remains project_tasks';

CREATE VIEW public.schedule_dependencies AS
SELECT
  d.id,
  d.project_id,
  d.predecessor_task_id AS predecessor_id,
  d.successor_task_id AS successor_id,
  d.relation_type,
  COALESCE(d.lag_days, ROUND((d.lag_duration::numeric / 480.0), 4)) AS lag_days,
  COALESCE(d.lag_is_percentage, false) AS lag_is_percentage,
  d.lag_duration,
  d.created_at
FROM public.task_dependencies d;

COMMENT ON VIEW public.schedule_dependencies IS
  'Compatibility view over task_dependencies';

-- -----------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------

ALTER TABLE public.schedule_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_task_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_calendars_select ON public.schedule_calendars;
CREATE POLICY schedule_calendars_select ON public.schedule_calendars
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_calendars_write ON public.schedule_calendars;
CREATE POLICY schedule_calendars_write ON public.schedule_calendars
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_task_segments_select ON public.schedule_task_segments;
CREATE POLICY schedule_task_segments_select ON public.schedule_task_segments
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_task_segments_write ON public.schedule_task_segments;
CREATE POLICY schedule_task_segments_write ON public.schedule_task_segments
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_resources_select ON public.schedule_resources;
CREATE POLICY schedule_resources_select ON public.schedule_resources
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_resources_write ON public.schedule_resources;
CREATE POLICY schedule_resources_write ON public.schedule_resources
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_assignments_select ON public.schedule_assignments;
CREATE POLICY schedule_assignments_select ON public.schedule_assignments
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_assignments_write ON public.schedule_assignments;
CREATE POLICY schedule_assignments_write ON public.schedule_assignments
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

NOTIFY pgrst, 'reload schema';
