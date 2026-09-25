-- =====================================================
-- Schedule engine schema (بخش ۱) — migrate after 74
-- Run once in Supabase SQL Editor
--
-- Design naming → existing SitePilot tables:
--   schedule_activities   → public.project_tasks  (canonical; do NOT create parallel)
--   schedule_dependencies → public.task_dependencies
--   float_history         → already exists (task_id = activity)
--   schedule_alerts       → already exists
--
-- This migration:
--   1) Extends project_tasks with OBS/CBS, constraints, physical progress/weight,
--      baseline extras, EVM, calendar link, import metadata
--   2) Extends task_dependencies with lag_days + percentage-lag flag
--   3) Extends schedule_calculations / float_history with free_float
--   4) Creates calendars, task segments, resources, assignments
--   5) Compatibility VIEWS for the design names (read path)
-- =====================================================

-- -----------------------------------------------------
-- 1) project_tasks — activity fields from schedule_activities design
-- -----------------------------------------------------

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS external_id TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS outline_number TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS outline_level INT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS obs_code TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS cbs_code TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS remaining_duration_days NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS calendar_id UUID;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS constraint_type TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS constraint_date TIMESTAMPTZ;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS baseline_duration_days NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS baseline_cost NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS baseline_work_hours NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS physical_percent_complete NUMERIC DEFAULT 0;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS actual_finish TIMESTAMPTZ;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS actual_duration_days NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS status_date TIMESTAMPTZ;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS work_hours NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS cost NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS fixed_cost NUMERIC;

-- physical_weight: same semantic domain as schedule_weight (MSP وزن)
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS physical_weight NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS planned_value NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS earned_value NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS flag BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS priority INT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS is_manual_scheduled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS has_split BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS is_recurring_master BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS source_file TEXT;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

-- Constraint type allow-list (ASAP/ALAP/SNET/FNLT/MSO/MFO + null)
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

-- Generated earned weighted progress (weight × physical % / 100)
-- Drop/recreate if definition changes
ALTER TABLE public.project_tasks
  DROP COLUMN IF EXISTS earned_weighted_progress;

ALTER TABLE public.project_tasks
  ADD COLUMN earned_weighted_progress NUMERIC
  GENERATED ALWAYS AS (
    COALESCE(physical_weight, 0) * COALESCE(physical_percent_complete, 0) / 100.0
  ) STORED;

COMMENT ON COLUMN public.project_tasks.external_id IS 'شناسه منبع (مثلاً MSP UID به‌صورت متن)';
COMMENT ON COLUMN public.project_tasks.outline_number IS 'شماره سلسله‌مراتبی MSP OutlineNumber';
COMMENT ON COLUMN public.project_tasks.outline_level IS 'سطح OutlineLevel';
COMMENT ON COLUMN public.project_tasks.obs_code IS 'واحد مسئول سازمانی (OBS)';
COMMENT ON COLUMN public.project_tasks.cbs_code IS 'دسته هزینه (CBS)';
COMMENT ON COLUMN public.project_tasks.physical_percent_complete IS 'پیشرفت فیزیکی — منبع اصلی حقیقت (٪)';
COMMENT ON COLUMN public.project_tasks.physical_weight IS 'وزن فیزیکی فعالیت؛ در سطح leaf باید با سرشاخه جمع‌پذیر باشد';
COMMENT ON COLUMN public.project_tasks.earned_weighted_progress IS 'physical_weight × physical_percent_complete / 100';
COMMENT ON COLUMN public.project_tasks.planned_value IS 'EVM PV';
COMMENT ON COLUMN public.project_tasks.earned_value IS 'EVM EV';
COMMENT ON COLUMN public.project_tasks.actual_cost IS 'EVM AC';
COMMENT ON COLUMN public.project_tasks.status_date IS 'Data Date همان بار Import/محاسبه';
COMMENT ON COLUMN public.project_tasks.constraint_type IS 'ASAP/ALAP/SNET/SNLT/FNET/FNLT/MSO/MFO';

-- Backfill from existing MSP fields
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

CREATE INDEX IF NOT EXISTS idx_project_tasks_wbs
  ON public.project_tasks(project_id, wbs_code);

CREATE INDEX IF NOT EXISTS idx_project_tasks_obs
  ON public.project_tasks(project_id, obs_code)
  WHERE obs_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_cbs
  ON public.project_tasks(project_id, cbs_code)
  WHERE cbs_code IS NOT NULL;

-- -----------------------------------------------------
-- 2) task_dependencies — lag_days + percentage lag flag
-- -----------------------------------------------------

ALTER TABLE public.task_dependencies
  ADD COLUMN IF NOT EXISTS lag_days NUMERIC;

ALTER TABLE public.task_dependencies
  ADD COLUMN IF NOT EXISTS lag_is_percentage BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.task_dependencies.lag_duration IS 'تأخیر به دقیقه (MSP LagFormat) — مسیر فعلی اپ';
COMMENT ON COLUMN public.task_dependencies.lag_days IS 'تأخیر به روز کاری (برای موتور CPM/تقویم)';
COMMENT ON COLUMN public.task_dependencies.lag_is_percentage IS 'اگر true: هشدار بده و در محاسبه استفاده نکن';

-- Backfill lag_days from minutes (8h day = 480 min) when missing
UPDATE public.task_dependencies
SET lag_days = ROUND((lag_duration::numeric / 480.0), 4)
WHERE lag_days IS NULL;

-- -----------------------------------------------------
-- 3) CPM free float on calculations + history
-- -----------------------------------------------------

ALTER TABLE public.schedule_calculations
  ADD COLUMN IF NOT EXISTS free_float NUMERIC;

ALTER TABLE public.float_history
  ADD COLUMN IF NOT EXISTS free_float NUMERIC;

COMMENT ON COLUMN public.schedule_calculations.free_float IS 'شناوری آزاد (روز) — محاسبه موتور CPM';
COMMENT ON COLUMN public.float_history.free_float IS 'شناوری آزاد در آن نمونه تاریخچه';

-- Cached float mirrors on activity (optional denormalized read; source of truth = schedule_calculations)
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS total_float_days NUMERIC;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS free_float_days NUMERIC;

COMMENT ON COLUMN public.project_tasks.total_float_days IS 'کش شناوری کل — همیشه توسط موتور CPM پر می‌شود، نه ورودی خام فایل';
COMMENT ON COLUMN public.project_tasks.free_float_days IS 'کش شناوری آزاد — توسط موتور CPM';

-- -----------------------------------------------------
-- 4) schedule_calendars
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

COMMENT ON TABLE public.schedule_calendars IS 'تقویم کاری پروژه برای موتور زمان‌بندی';
COMMENT ON COLUMN public.schedule_calendars.working_days IS 'روزهای کاری هفته (JSONB)';
COMMENT ON COLUMN public.schedule_calendars.daily_shifts IS 'شیفت‌های روزانه';
COMMENT ON COLUMN public.schedule_calendars.exceptions IS 'تعطیلات/استثناها';

-- FK from project_tasks.calendar_id (deferred until table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_calendar_id_fkey'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_calendar_id_fkey
      FOREIGN KEY (calendar_id) REFERENCES public.schedule_calendars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------
-- 5) schedule_task_segments (task splitting)
-- -----------------------------------------------------

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

COMMENT ON TABLE public.schedule_task_segments IS 'بخش‌های تقسیم‌شده یک فعالیت (Task Split)';

-- -----------------------------------------------------
-- 6) schedule_resources + schedule_assignments
-- -----------------------------------------------------

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

COMMENT ON TABLE public.schedule_resources IS 'منابع زمان‌بندی (کار / مصالح / هزینه)';
COMMENT ON TABLE public.schedule_assignments IS 'تخصیص منبع به فعالیت';

-- -----------------------------------------------------
-- 7) Compatibility VIEWS (design names)
-- If someone previously created schedule_activities / schedule_dependencies
-- as real TABLEs (from the design DDL), rename them aside first — canonical
-- storage remains project_tasks / task_dependencies.
-- -----------------------------------------------------

DO $$
BEGIN
  -- schedule_activities: table → backup; view → drop for recreate
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_activities' AND c.relkind = 'r'
  ) THEN
    -- Drop FKs pointing at the legacy table if any (best-effort)
    ALTER TABLE IF EXISTS public.schedule_activities
      RENAME TO schedule_activities_legacy_backup;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_activities' AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.schedule_activities;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_dependencies' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE IF EXISTS public.schedule_dependencies
      RENAME TO schedule_dependencies_legacy_backup;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_class c
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
  d.lag_is_percentage,
  d.lag_duration,
  d.created_at
FROM public.task_dependencies d;

COMMENT ON VIEW public.schedule_dependencies IS
  'Compatibility view over task_dependencies (predecessor/successor naming)';

-- -----------------------------------------------------
-- 8) RLS for new tables
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
