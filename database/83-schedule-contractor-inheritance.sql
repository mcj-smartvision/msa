-- Schedule contractor assignment with hierarchical inheritance.
-- Canonical activities table: project_tasks
-- Existing direct assignment: subcontractor_id (migration 42)

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS resolved_subcontractor_id UUID
  REFERENCES public.project_subcontractors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_resolved_subcontractor
  ON public.project_tasks(project_id, resolved_subcontractor_id);

COMMENT ON COLUMN public.project_tasks.subcontractor_id IS
  'Direct contractor assignment. NULL means inherit from the closest assigned ancestor.';
COMMENT ON COLUMN public.project_tasks.resolved_subcontractor_id IS
  'Final contractor after hierarchical inheritance from parent_id.';

CREATE OR REPLACE FUNCTION public.recompute_project_task_contractors(p_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset first so malformed/cyclic rows can never retain stale inherited data.
  UPDATE public.project_tasks task
  SET resolved_subcontractor_id = task.subcontractor_id
  WHERE task.project_id = p_project_id
    AND task.resolved_subcontractor_id IS DISTINCT FROM task.subcontractor_id;

  WITH RECURSIVE inherited AS (
    SELECT
      t.id,
      t.subcontractor_id AS resolved_id,
      ARRAY[t.id] AS visited
    FROM public.project_tasks t
    WHERE t.project_id = p_project_id
      AND (
        t.parent_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.project_tasks p
          WHERE p.id = t.parent_id AND p.project_id = p_project_id
        )
      )

    UNION ALL

    SELECT
      child.id,
      COALESCE(child.subcontractor_id, parent.resolved_id),
      parent.visited || child.id
    FROM inherited parent
    JOIN public.project_tasks child
      ON child.parent_id = parent.id
     AND child.project_id = p_project_id
    WHERE NOT child.id = ANY(parent.visited)
  )
  UPDATE public.project_tasks task
  SET resolved_subcontractor_id = inherited.resolved_id
  FROM inherited
  WHERE task.id = inherited.id
    AND task.resolved_subcontractor_id IS DISTINCT FROM inherited.resolved_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_project_task_contractor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.project_tasks parent
    WHERE parent.id = NEW.parent_id
      AND parent.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Parent task must belong to the same project';
  END IF;
  IF NEW.subcontractor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.project_subcontractors contractor
    WHERE contractor.id = NEW.subcontractor_id
      AND contractor.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Contractor must belong to the same project';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_validate_contractor ON public.project_tasks;
CREATE TRIGGER trg_project_task_validate_contractor
BEFORE INSERT OR UPDATE OF subcontractor_id, parent_id, project_id
ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_project_task_contractor();

CREATE OR REPLACE FUNCTION public.refresh_project_task_contractors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_guard TEXT := 'msa.contractor_refresh_' || replace(NEW.project_id::text, '-', '_');
  old_guard TEXT;
BEGIN
  IF current_setting(new_guard, true) IS DISTINCT FROM '1' THEN
    PERFORM set_config(new_guard, '1', true);
    PERFORM public.recompute_project_task_contractors(NEW.project_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    old_guard := 'msa.contractor_refresh_' || replace(OLD.project_id::text, '-', '_');
    IF current_setting(old_guard, true) IS DISTINCT FROM '1' THEN
      PERFORM set_config(old_guard, '1', true);
      PERFORM public.recompute_project_task_contractors(OLD.project_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_refresh_contractors ON public.project_tasks;
CREATE CONSTRAINT TRIGGER trg_project_task_refresh_contractors
AFTER INSERT OR UPDATE OF subcontractor_id, parent_id, project_id
ON public.project_tasks
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.refresh_project_task_contractors();

SELECT public.recompute_project_task_contractors(project_id)
FROM (SELECT DISTINCT project_id FROM public.project_tasks) projects;

-- Expose the requested names on the compatibility view when it exists.
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'schedule_activities'
      AND c.relkind = 'v'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.schedule_activities AS
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
        t.updated_at,
        t.subcontractor_id AS contractor_id,
        t.resolved_subcontractor_id AS resolved_contractor_id
      FROM public.project_tasks t
      LEFT JOIN public.schedule_calculations sc
        ON sc.task_id = t.id AND sc.project_id = t.project_id
    $view$;
  END IF;
END
$outer$;
