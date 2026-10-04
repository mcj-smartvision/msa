-- =====================================================
-- Look-ahead constraints («قفل‌ها») — محدودیت‌هایی که جلوی شروع کارهای هفته‌های آینده را می‌گیرند
--
-- ⚠ فقط فایل برای بازبینی. تا تأیید صریح روی هیچ پایگاه داده‌ای اجرا نشود.
--
-- Feeds the manager «شاخص تعهدات هفتگی (PPC)» section:
--   • «قفل‌های هفتهٔ آینده»: open constraints whose need date falls in the coming weeks
--   • heatmap: per coming week × constraint type, how many planned activities are still locked
--   • readiness: an activity is «آماده» when none of its constraints is open
--
-- One constraint can lock several activities (constraint ↔ activity link table).
-- «بحرانی» = is_critical (set by the planner) OR it locks two or more activities; the app also
-- treats a lock on a critical-path activity (project_tasks.is_critical) as critical.
--
-- Access (position keys from public.positions):
--   create / edit / remove a constraint : planning_engineer, site_supervisor, project_manager
--   read                                : any project member, system admin
-- =====================================================

-- -----------------------------------------------------
-- 0) Role helper
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.lac_has_position(p_project_id UUID, p_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.member_positions mp ON mp.project_member_id = pm.id
    JOIN public.positions pos ON pos.id = mp.position_id
    WHERE pm.project_id = p_project_id
      AND pm.user_id = auth.uid()
      AND pm.is_active
      AND pos.is_active
      AND pos.project_id = pm.project_id
      AND pos.key = ANY (p_keys)
  );
$$;

REVOKE ALL ON FUNCTION public.lac_has_position(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lac_has_position(UUID, TEXT[]) TO authenticated, service_role;

-- -----------------------------------------------------
-- 1) lookahead_constraints
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lookahead_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  constraint_type TEXT NOT NULL CHECK (
    constraint_type IN (
      'materials',          -- مصالح
      'design_info',        -- نقشه / ابهام فنی
      'crew',               -- اکیپ
      'equipment',          -- تجهیزات
      'permit_approval',    -- مجوز / تأییدیه
      'prerequisite_work',  -- کار پیش‌نیاز
      'other'               -- سایر
    )
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'cancelled')),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  -- Latest date the constraint must be removed (normally the planned start of the first locked activity).
  need_date DATE NOT NULL,
  expected_removal_date DATE,
  removed_at TIMESTAMPTZ,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lookahead_constraints_removed_stamp CHECK ((status = 'removed') = (removed_at IS NOT NULL)),
  CONSTRAINT lookahead_constraints_other_note CHECK (constraint_type <> 'other' OR length(btrim(coalesce(note, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_lookahead_constraints_project_open
  ON public.lookahead_constraints(project_id, need_date) WHERE status = 'open';

COMMENT ON TABLE public.lookahead_constraints IS
  'قفل‌های Look-ahead: هر محدودیتی که جلوی شروع یک یا چند کار را می‌گیرد (مصالح، نقشه، اکیپ، تجهیزات، مجوز…)';
COMMENT ON COLUMN public.lookahead_constraints.need_date IS
  'آخرین تاریخی که قفل باید باز شود (معمولاً شروع برنامه‌ای نخستین کار قفل‌شده)';

-- -----------------------------------------------------
-- 2) lookahead_constraint_items — activities locked by a constraint
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lookahead_constraint_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constraint_id UUID NOT NULL REFERENCES public.lookahead_constraints(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.workshop_packages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lookahead_constraint_items_target CHECK (task_id IS NOT NULL OR package_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lookahead_constraint_items_task
  ON public.lookahead_constraint_items(constraint_id, task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lookahead_constraint_items_package
  ON public.lookahead_constraint_items(constraint_id, package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lookahead_constraint_items_task ON public.lookahead_constraint_items(task_id) WHERE task_id IS NOT NULL;

-- -----------------------------------------------------
-- 3) Guards: project consistency, removal stamp, updated_at
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.lac_guard_constraint()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
  ELSIF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'پروژه و سازندهٔ قفل قابل تغییر نیست';
  END IF;
  IF NEW.status = 'removed' AND NEW.removed_at IS NULL THEN
    NEW.removed_at := now();
  ELSIF NEW.status <> 'removed' THEN
    NEW.removed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lac_guard_constraint ON public.lookahead_constraints;
CREATE TRIGGER trg_lac_guard_constraint
  BEFORE INSERT OR UPDATE ON public.lookahead_constraints
  FOR EACH ROW EXECUTE FUNCTION public.lac_guard_constraint();

CREATE OR REPLACE FUNCTION public.lac_guard_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_project UUID;
BEGIN
  SELECT project_id INTO v_project FROM public.lookahead_constraints WHERE id = NEW.constraint_id;
  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_tasks WHERE id = NEW.task_id AND project_id = v_project
  ) THEN
    RAISE EXCEPTION 'فعالیت قفل‌شده باید از همان پروژه باشد';
  END IF;
  IF NEW.package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workshop_packages WHERE id = NEW.package_id AND project_id = v_project
  ) THEN
    RAISE EXCEPTION 'بستهٔ کاری قفل‌شده باید از همان پروژه باشد';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lac_guard_item ON public.lookahead_constraint_items;
CREATE TRIGGER trg_lac_guard_item
  BEFORE INSERT OR UPDATE ON public.lookahead_constraint_items
  FOR EACH ROW EXECUTE FUNCTION public.lac_guard_item();

-- -----------------------------------------------------
-- 4) RLS — members read; planner, site supervisor and PM write
-- -----------------------------------------------------
ALTER TABLE public.lookahead_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookahead_constraint_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lookahead_constraints_select ON public.lookahead_constraints;
CREATE POLICY lookahead_constraints_select ON public.lookahead_constraints
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS lookahead_constraints_write ON public.lookahead_constraints;
CREATE POLICY lookahead_constraints_write ON public.lookahead_constraints
  FOR ALL
  USING (public.lac_has_position(project_id, ARRAY['planning_engineer', 'site_supervisor', 'project_manager']))
  WITH CHECK (public.lac_has_position(project_id, ARRAY['planning_engineer', 'site_supervisor', 'project_manager']));

DROP POLICY IF EXISTS lookahead_constraint_items_select ON public.lookahead_constraint_items;
CREATE POLICY lookahead_constraint_items_select ON public.lookahead_constraint_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lookahead_constraints c
      WHERE c.id = constraint_id AND (public.is_project_member(c.project_id) OR public.is_system_admin())
    )
  );

DROP POLICY IF EXISTS lookahead_constraint_items_write ON public.lookahead_constraint_items;
CREATE POLICY lookahead_constraint_items_write ON public.lookahead_constraint_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.lookahead_constraints c
      WHERE c.id = constraint_id
        AND public.lac_has_position(c.project_id, ARRAY['planning_engineer', 'site_supervisor', 'project_manager'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lookahead_constraints c
      WHERE c.id = constraint_id
        AND public.lac_has_position(c.project_id, ARRAY['planning_engineer', 'site_supervisor', 'project_manager'])
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookahead_constraints, public.lookahead_constraint_items TO authenticated;
GRANT ALL ON public.lookahead_constraints, public.lookahead_constraint_items TO service_role;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------
-- 5) Validation (read-only)
-- -----------------------------------------------------
SELECT
  to_regclass('public.lookahead_constraints') IS NOT NULL AS has_lookahead_constraints,
  to_regclass('public.lookahead_constraint_items') IS NOT NULL AS has_lookahead_constraint_items,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_lac_guard_constraint', 'trg_lac_guard_item')) AS guard_triggers,
  (SELECT count(*) FROM pg_policies WHERE tablename IN ('lookahead_constraints', 'lookahead_constraint_items')) AS policies;
