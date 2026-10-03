-- =====================================================
-- Weekly Work Plan (WWP) — برنامهٔ هفتگی متعهد و تعهدات آن (منبع رسمی PPC، KPI-05)
--
-- ⚠ فقط فایل برای بازبینی. پایگاه دادهٔ پروژه Hosted (Supabase) است؛ تا تأیید صریح اجرا نشود.
--
-- Lifecycle of a plan:
--   DRAFT  → commitments may be added, edited and removed.
--   FROZEN → frozen_at is stamped; the commitment list and planned fields are locked.
--            Only the outcome (is_completed, root cause, actual_output) may be recorded.
--   CLOSED → every commitment has an outcome; nothing changes any more. PPC reads only CLOSED weeks.
-- Status only moves forward (DRAFT → FROZEN → CLOSED).
--
-- Weeks follow the Tehran calendar: Saturday to Friday (start_date is a Saturday, end_date = start_date + 6).
--
-- Access (Lean / Last Planner governance; position keys from public.positions):
--   create / edit DRAFT plan and its commitments     : planning_engineer, site_supervisor
--   freeze (DRAFT → FROZEN), no later than Saturday  : project_manager, planning_engineer
--   record outcomes and close (FROZEN → CLOSED),
--     from the week's Friday on                      : project_manager only
--   read                                             : any project member, system admin
-- Enforced by RLS (writer roles) and by the lifecycle triggers (per action). The service role
-- (maintenance) bypasses the role checks but never the lifecycle rules.
-- =====================================================

-- -----------------------------------------------------
-- 0) Role helpers
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.wwp_has_position(p_project_id UUID, p_keys TEXT[])
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

CREATE OR REPLACE FUNCTION public.wwp_is_maintenance()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.wwp_require_position(p_project_id UUID, p_keys TEXT[], p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF public.wwp_is_maintenance() THEN
    RETURN;
  END IF;
  IF NOT public.wwp_has_position(p_project_id, p_keys) THEN
    RAISE EXCEPTION 'دسترسی ندارید: % فقط برای نقش‌های % مجاز است', p_action, array_to_string(p_keys, '، ')
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.wwp_today_tehran()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Tehran')::date;
$$;

REVOKE ALL ON FUNCTION public.wwp_has_position(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wwp_has_position(UUID, TEXT[]) TO authenticated, service_role;

-- -----------------------------------------------------
-- 1) weekly_work_plans
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_work_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FROZEN', 'CLOSED')),
  frozen_at TIMESTAMPTZ,
  frozen_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_work_plans_week_span CHECK (end_date = start_date + 6),
  CONSTRAINT weekly_work_plans_starts_saturday CHECK (EXTRACT(DOW FROM start_date) = 6),
  CONSTRAINT weekly_work_plans_frozen_stamp CHECK (status = 'DRAFT' OR frozen_at IS NOT NULL),
  CONSTRAINT weekly_work_plans_closed_stamp CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL),
  CONSTRAINT weekly_work_plans_project_week UNIQUE (project_id, week_number),
  CONSTRAINT weekly_work_plans_project_start UNIQUE (project_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_work_plans_project_status_start
  ON public.weekly_work_plans(project_id, status, start_date DESC);

COMMENT ON TABLE public.weekly_work_plans IS
  'برنامهٔ هفتگی متعهد (WWP) هر پروژه؛ شنبه تا جمعه. PPC فقط از هفته‌های CLOSED خوانده می‌شود.';
COMMENT ON COLUMN public.weekly_work_plans.week_number IS
  'شمارهٔ ترتیبی هفته در پروژه (۱ = نخستین هفتهٔ برنامه‌ریزی‌شده)';
COMMENT ON COLUMN public.weekly_work_plans.frozen_at IS
  'زمان قفل‌شدن تعهدات (حداکثر تا پایان شنبهٔ همان هفته)؛ پس از آن فهرست تعهدات تغییر نمی‌کند';

-- -----------------------------------------------------
-- 2) wwp_commitments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wwp_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wwp_id UUID NOT NULL REFERENCES public.weekly_work_plans(id) ON DELETE CASCADE,
  -- Work front: an MSP activity and/or a workshop package. History survives schedule edits.
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.workshop_packages(id) ON DELETE SET NULL,
  wbs_code TEXT,
  description TEXT NOT NULL CHECK (length(btrim(description)) > 0),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  planned_output NUMERIC CHECK (planned_output IS NULL OR planned_output >= 0),
  actual_output NUMERIC CHECK (actual_output IS NULL OR actual_output >= 0),
  output_uom TEXT,
  -- NULL until the outcome is recorded; required for every commitment before the week is CLOSED.
  is_completed BOOLEAN,
  root_cause_category TEXT CHECK (
    root_cause_category IS NULL OR root_cause_category IN (
      'materials',          -- مصالح
      'crew',               -- اکیپ / نیروی انسانی
      'equipment',          -- تجهیزات
      'permit_approval',    -- مجوز / تأییدیه
      'design_info',        -- نقشه / ابهام فنی
      'prerequisite_work',  -- کار پیش‌نیاز تمام نشده
      'weather',            -- جوی
      'site_access',        -- دسترسی / کارگاه
      'payment',            -- پرداخت
      'qc_rework',          -- رفع عیب (QC)
      'other'               -- سایر
    )
  ),
  root_cause_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A missed commitment must say why; a completed one carries no root cause.
  CONSTRAINT wwp_commitments_root_cause CHECK (
    (is_completed IS DISTINCT FROM FALSE OR root_cause_category IS NOT NULL)
    AND (is_completed IS DISTINCT FROM TRUE OR root_cause_category IS NULL)
  ),
  CONSTRAINT wwp_commitments_other_note CHECK (
    root_cause_category IS DISTINCT FROM 'other' OR length(btrim(coalesce(root_cause_note, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_wwp_commitments_wwp ON public.wwp_commitments(wwp_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_wwp_commitments_task ON public.wwp_commitments(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wwp_commitments_package ON public.wwp_commitments(package_id) WHERE package_id IS NOT NULL;

COMMENT ON TABLE public.wwp_commitments IS
  'تعهدات یک برنامهٔ هفتگی؛ PPC = تعداد is_completed=true ÷ کل تعهدات هفتهٔ بسته‌شده × ۱۰۰';
COMMENT ON COLUMN public.wwp_commitments.root_cause_category IS
  'علت عدم تحقق (فقط وقتی is_completed=false؛ اجباری)';

-- -----------------------------------------------------
-- 3) Lifecycle + role guards
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.wwp_guard_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_open INTEGER;
  v_total INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A project deletion cascades here after the project row is gone; allow that path.
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id) THEN
      RETURN OLD;
    END IF;
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'فقط برنامهٔ هفتگی پیش‌نویس (DRAFT) قابل حذف است';
    END IF;
    PERFORM public.wwp_require_position(OLD.project_id, ARRAY['planning_engineer', 'site_supervisor'], 'حذف برنامهٔ هفتگی');
    RETURN OLD;
  END IF;

  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'برنامهٔ هفتگی باید با وضعیت DRAFT ساخته شود';
    END IF;
    PERFORM public.wwp_require_position(NEW.project_id, ARRAY['planning_engineer', 'site_supervisor'], 'ایجاد برنامهٔ هفتگی');
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
    RETURN NEW;
  END IF;

  IF OLD.status = 'CLOSED' THEN
    RAISE EXCEPTION 'برنامهٔ هفتگی بسته‌شده قابل تغییر نیست';
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'پروژه و سازندهٔ برنامهٔ هفتگی قابل تغییر نیست';
  END IF;

  IF OLD.status <> 'DRAFT' AND (
    NEW.week_number IS DISTINCT FROM OLD.week_number
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.end_date IS DISTINCT FROM OLD.end_date
    OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at
    OR NEW.frozen_by IS DISTINCT FROM OLD.frozen_by
  ) THEN
    RAISE EXCEPTION 'پس از قفل‌شدن، هفته و زمان قفل برنامه قابل تغییر نیست';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Editing a draft (week, notes) belongs to its authors; a frozen plan only changes by closing.
    IF OLD.status = 'DRAFT' THEN
      PERFORM public.wwp_require_position(NEW.project_id, ARRAY['planning_engineer', 'site_supervisor'], 'ویرایش برنامهٔ هفتگی');
    ELSE
      PERFORM public.wwp_require_position(NEW.project_id, ARRAY['project_manager'], 'ویرایش برنامهٔ هفتگی قفل‌شده');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT ((OLD.status = 'DRAFT' AND NEW.status = 'FROZEN') OR (OLD.status = 'FROZEN' AND NEW.status = 'CLOSED')) THEN
    RAISE EXCEPTION 'تغییر وضعیت % → % مجاز نیست (فقط DRAFT → FROZEN → CLOSED)', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'FROZEN' THEN
    PERFORM public.wwp_require_position(NEW.project_id, ARRAY['project_manager', 'planning_engineer'], 'قفل‌کردن برنامهٔ هفتگی');
    IF NOT public.wwp_is_maintenance() AND public.wwp_today_tehran() > NEW.start_date THEN
      RAISE EXCEPTION 'قفل برنامهٔ هفتگی باید حداکثر تا شنبهٔ همان هفته (%) انجام شود', NEW.start_date;
    END IF;
    SELECT count(*) INTO v_total FROM public.wwp_commitments WHERE wwp_id = NEW.id;
    IF v_total = 0 THEN
      RAISE EXCEPTION 'برنامهٔ هفتگی بدون تعهد قابل قفل‌شدن نیست';
    END IF;
    NEW.frozen_at := now();
    NEW.frozen_by := auth.uid();
  END IF;

  IF NEW.status = 'CLOSED' THEN
    PERFORM public.wwp_require_position(NEW.project_id, ARRAY['project_manager'], 'بستن و ارزیابی هفته');
    IF NOT public.wwp_is_maintenance() AND public.wwp_today_tehran() < NEW.end_date THEN
      RAISE EXCEPTION 'هفته از جمعه (%) به بعد قابل بستن است', NEW.end_date;
    END IF;
    SELECT count(*) INTO v_open FROM public.wwp_commitments WHERE wwp_id = NEW.id AND is_completed IS NULL;
    IF v_open > 0 THEN
      RAISE EXCEPTION 'برای بستن هفته، نتیجهٔ همهٔ تعهدات باید ثبت شود (% مورد باز است)', v_open;
    END IF;
    NEW.closed_at := now();
    NEW.closed_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wwp_guard_plan ON public.weekly_work_plans;
CREATE TRIGGER trg_wwp_guard_plan
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_work_plans
  FOR EACH ROW EXECUTE FUNCTION public.wwp_guard_plan();

CREATE OR REPLACE FUNCTION public.wwp_guard_commitment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_project UUID;
BEGIN
  SELECT status, project_id INTO v_status, v_project
  FROM public.weekly_work_plans
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.wwp_id ELSE NEW.wwp_id END;

  -- The plan row is already gone when its own deletion cascades here.
  IF v_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'برنامهٔ هفتگی پیدا نشد';
  END IF;

  IF v_status = 'CLOSED' THEN
    RAISE EXCEPTION 'تعهدات هفتهٔ بسته‌شده قابل تغییر نیست';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.wwp_id IS DISTINCT FROM OLD.wwp_id THEN
    RAISE EXCEPTION 'تعهد به برنامهٔ هفتگی دیگری منتقل نمی‌شود';
  END IF;

  IF v_status = 'DRAFT' THEN
    PERFORM public.wwp_require_position(v_project, ARRAY['planning_engineer', 'site_supervisor'], 'ثبت و ویرایش تعهدات');
    IF TG_OP <> 'DELETE' AND (NEW.is_completed IS NOT NULL OR NEW.actual_output IS NOT NULL OR NEW.root_cause_category IS NOT NULL) THEN
      RAISE EXCEPTION 'نتیجهٔ تعهد فقط پس از قفل‌شدن برنامه ثبت می‌شود';
    END IF;
  END IF;

  IF v_status = 'FROZEN' THEN
    IF TG_OP IN ('INSERT', 'DELETE') THEN
      RAISE EXCEPTION 'پس از قفل‌شدن برنامه، تعهدی اضافه یا حذف نمی‌شود';
    END IF;
    IF NEW.task_id IS DISTINCT FROM OLD.task_id
      OR NEW.package_id IS DISTINCT FROM OLD.package_id
      OR NEW.wbs_code IS DISTINCT FROM OLD.wbs_code
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.planned_output IS DISTINCT FROM OLD.planned_output
      OR NEW.output_uom IS DISTINCT FROM OLD.output_uom
      OR NEW.sort_order IS DISTINCT FROM OLD.sort_order
      OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'پس از قفل‌شدن برنامه فقط نتیجهٔ تعهد (تحقق، علت، مقدار واقعی) ثبت می‌شود';
    END IF;
    PERFORM public.wwp_require_position(v_project, ARRAY['project_manager'], 'ثبت نتیجهٔ تعهدات (ارزیابی هفته)');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wwp_guard_commitment ON public.wwp_commitments;
CREATE TRIGGER trg_wwp_guard_commitment
  BEFORE INSERT OR UPDATE OR DELETE ON public.wwp_commitments
  FOR EACH ROW EXECUTE FUNCTION public.wwp_guard_commitment();

-- -----------------------------------------------------
-- 4) PPC per closed week (read by the KPI engine)
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.wwp_weekly_ppc
WITH (security_invoker = true) AS
SELECT
  p.id AS wwp_id,
  p.project_id,
  p.week_number,
  p.start_date,
  p.end_date,
  p.frozen_at,
  p.closed_at,
  count(c.id)::INTEGER AS planned_count,
  count(c.id) FILTER (WHERE c.is_completed IS TRUE)::INTEGER AS completed_count,
  CASE WHEN count(c.id) > 0
    THEN round(100.0 * count(c.id) FILTER (WHERE c.is_completed IS TRUE) / count(c.id), 2)
  END AS ppc
FROM public.weekly_work_plans p
LEFT JOIN public.wwp_commitments c ON c.wwp_id = p.id
WHERE p.status = 'CLOSED'
GROUP BY p.id;

COMMENT ON VIEW public.wwp_weekly_ppc IS
  'PPC هر هفتهٔ بسته‌شده: completed_count ÷ planned_count × ۱۰۰';

-- -----------------------------------------------------
-- 5) RLS — members read; only the three WWP roles write (per-action rules in the triggers)
-- -----------------------------------------------------
ALTER TABLE public.weekly_work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wwp_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_work_plans_select ON public.weekly_work_plans;
CREATE POLICY weekly_work_plans_select ON public.weekly_work_plans
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS weekly_work_plans_write ON public.weekly_work_plans;
CREATE POLICY weekly_work_plans_write ON public.weekly_work_plans
  FOR ALL
  USING (public.wwp_has_position(project_id, ARRAY['project_manager', 'planning_engineer', 'site_supervisor']))
  WITH CHECK (public.wwp_has_position(project_id, ARRAY['project_manager', 'planning_engineer', 'site_supervisor']));

DROP POLICY IF EXISTS wwp_commitments_select ON public.wwp_commitments;
CREATE POLICY wwp_commitments_select ON public.wwp_commitments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.weekly_work_plans p
      WHERE p.id = wwp_id AND (public.is_project_member(p.project_id) OR public.is_system_admin())
    )
  );

DROP POLICY IF EXISTS wwp_commitments_write ON public.wwp_commitments;
CREATE POLICY wwp_commitments_write ON public.wwp_commitments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.weekly_work_plans p
      WHERE p.id = wwp_id
        AND public.wwp_has_position(p.project_id, ARRAY['project_manager', 'planning_engineer', 'site_supervisor'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.weekly_work_plans p
      WHERE p.id = wwp_id
        AND public.wwp_has_position(p.project_id, ARRAY['project_manager', 'planning_engineer', 'site_supervisor'])
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_work_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wwp_commitments TO authenticated;
GRANT SELECT ON public.wwp_weekly_ppc TO authenticated;
GRANT ALL ON public.weekly_work_plans, public.wwp_commitments TO service_role;
GRANT SELECT ON public.wwp_weekly_ppc TO service_role;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------
-- 6) Validation (read-only)
-- -----------------------------------------------------
SELECT
  to_regclass('public.weekly_work_plans') IS NOT NULL AS has_weekly_work_plans,
  to_regclass('public.wwp_commitments') IS NOT NULL AS has_wwp_commitments,
  to_regclass('public.wwp_weekly_ppc') IS NOT NULL AS has_wwp_weekly_ppc,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_wwp_guard_plan', 'trg_wwp_guard_commitment')) AS guard_triggers,
  (SELECT count(*) FROM pg_policies WHERE tablename IN ('weekly_work_plans', 'wwp_commitments')) AS policies;
