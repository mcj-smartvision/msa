-- =====================================================
-- Project cost estimate — تنظیمات مالی و برآورد اولیهٔ پروژه
-- Run once in Supabase SQL Editor. Safe to re-run; existing data is not touched.
--
-- One row per project, entered by the project manager. Amounts are whole toman.
--   contract_value : revenue agreed with the employer (never used as the cost budget)
--   planned_*      : approved start / finish of the project
--   monthly_*      : time-based costs; × planned duration (Jalali months) gives the planned total
--   *_in_wbs       : the amount is already inside the WBS activity budgets, so BAC does not add it again
--   risk_*         : risk reserve, a percent of BAC base or a fixed amount
-- BAC base / total are computed by the app from these values and the WBS rows; they are not stored.
-- Existing projects have no row; the manager dashboard shows "needs setup" instead of guessing from
-- projects.budget.
-- Read: project members and system admins. Write: the project's project_manager and system admins.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_cost_estimates (
  project_id                 uuid        PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_value             numeric     CHECK (contract_value IS NULL OR contract_value >= 0),
  planned_start              date,
  planned_finish             date,
  monthly_overhead           numeric     CHECK (monthly_overhead IS NULL OR monthly_overhead >= 0),
  overhead_in_wbs            boolean     NOT NULL DEFAULT false,
  monthly_personnel          numeric     CHECK (monthly_personnel IS NULL OR monthly_personnel >= 0),
  personnel_in_wbs           boolean     NOT NULL DEFAULT false,
  planned_employer_purchases numeric     CHECK (planned_employer_purchases IS NULL OR planned_employer_purchases >= 0),
  purchases_in_wbs           boolean     NOT NULL DEFAULT false,
  other_fixed_costs          numeric     CHECK (other_fixed_costs IS NULL OR other_fixed_costs >= 0),
  risk_mode                  text        NOT NULL DEFAULT 'percent' CHECK (risk_mode IN ('percent', 'amount')),
  risk_value                 numeric     CHECK (risk_value IS NULL OR risk_value >= 0),
  notes                      text,
  approved_at                timestamptz,
  approved_by                uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                 uuid        REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_cost_estimates_dates CHECK (
    planned_start IS NULL OR planned_finish IS NULL OR planned_finish > planned_start
  ),
  CONSTRAINT project_cost_estimates_risk_percent CHECK (
    risk_mode <> 'percent' OR risk_value IS NULL OR risk_value <= 100
  )
);

CREATE OR REPLACE FUNCTION public.pce_is_project_manager(p_project_id uuid)
RETURNS boolean
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
      AND pos.key = 'project_manager'
  );
$$;

REVOKE ALL ON FUNCTION public.pce_is_project_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pce_is_project_manager(uuid) TO authenticated, service_role;

ALTER TABLE public.project_cost_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_cost_estimates_select ON public.project_cost_estimates;
CREATE POLICY project_cost_estimates_select ON public.project_cost_estimates
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_cost_estimates_write ON public.project_cost_estimates;
CREATE POLICY project_cost_estimates_write ON public.project_cost_estimates
  FOR ALL TO authenticated
  USING (public.pce_is_project_manager(project_id) OR public.is_system_admin())
  WITH CHECK (public.pce_is_project_manager(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cost_estimates TO authenticated;
GRANT ALL ON public.project_cost_estimates TO service_role;

COMMENT ON TABLE public.project_cost_estimates IS
  'تنظیمات مالی و برآورد اولیهٔ هر پروژه (تومان). ارزش قرارداد جدا از بودجهٔ هزینهٔ داخلی (BAC) است؛ BAC در برنامه محاسبه می‌شود.';

NOTIFY pgrst, 'reload schema';
