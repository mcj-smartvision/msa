-- =====================================================
-- HOTFIX: finish migration 75 after error
--   ERROR 42809: "schedule_activities" is not a view
--
-- Sections 1–6 of 75 likely already applied. Run ONLY this
-- script in Supabase SQL Editor to create the views + RLS.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'schedule_activities' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.schedule_activities
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
    ALTER TABLE public.schedule_dependencies
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
  COALESCE(d.lag_is_percentage, false) AS lag_is_percentage,
  d.lag_duration,
  d.created_at
FROM public.task_dependencies d;

COMMENT ON VIEW public.schedule_dependencies IS
  'Compatibility view over task_dependencies (predecessor/successor naming)';

-- RLS for new tables (safe to re-run)
ALTER TABLE IF EXISTS public.schedule_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_task_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_assignments ENABLE ROW LEVEL SECURITY;

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
