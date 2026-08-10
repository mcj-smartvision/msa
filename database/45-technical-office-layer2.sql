-- =====================================================
-- Technical Office position + Layer 2 enrichment / flags
-- Run in Supabase SQL Editor after migration 44
-- Safe to re-run (idempotent)
-- =====================================================

-- Ensure i18n name columns exist (older DBs may miss them)
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_fa TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS name_de TEXT;

-- 1) Position: Technical Office Manager (مدیر دفتر فنی)
INSERT INTO public.positions (project_id, key, title, name_en, name_fa, description, is_active)
SELECT
  p.id,
  'technical_office',
  'Technical Office Manager',
  'Technical Office Manager',
  'مدیر دفتر فنی',
  'Quantity enrichment, near-term decomposition, and payment-readiness flags for Layer 2.',
  true
FROM public.projects p
ON CONFLICT (project_id, key) DO NOTHING;

-- Refresh seed RPC (includes technical_office)
CREATE OR REPLACE FUNCTION public.seed_project_positions(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  INSERT INTO public.positions (project_id, key, title, name_en, name_fa, description, is_active)
  VALUES
    (p_project_id, 'project_manager', 'Project Manager', 'Project Manager', 'مدیر پروژه', 'Overall project planning', true),
    (p_project_id, 'site_manager', 'Site Manager', 'Site Manager', 'مدیر کارگاه', 'Daily site leadership', true),
    (p_project_id, 'site_supervisor', 'Site Supervisor', 'Site Supervisor', 'سرپرست کارگاه', 'Daily operations', true),
    (p_project_id, 'technical_office', 'Technical Office Manager', 'Technical Office Manager', 'مدیر دفتر فنی', 'Quantity enrichment and payment-readiness flags', true),
    (p_project_id, 'civil_engineer', 'Civil Engineer', 'Civil Engineer', 'مهندس عمران', 'Civil works', true),
    (p_project_id, 'architect', 'Architect', 'Architect', 'معمار', 'Design compliance', true),
    (p_project_id, 'structural_engineer', 'Structural Engineer', 'Structural Engineer', 'مهندس سازه', 'Structural oversight', true),
    (p_project_id, 'mep_engineer', 'MEP Engineer', 'MEP Engineer', 'مهندس MEP', 'MEP systems', true),
    (p_project_id, 'hse_officer', 'HSE Officer', 'HSE Officer', 'مسئول ایمنی', 'Health and safety', true),
    (p_project_id, 'qa_qc_inspector', 'QA/QC Inspector', 'QA/QC Inspector', 'بازرس QA/QC', 'Quality inspections', true),
    (p_project_id, 'surveyor', 'Surveyor', 'Surveyor', 'نقشه‌بردار', 'Site measurements', true),
    (p_project_id, 'storekeeper', 'Storekeeper', 'Storekeeper', 'انباردار', 'Inventory management', true),
    (p_project_id, 'procurement_officer', 'Procurement Officer', 'Procurement Officer', 'مسئول خرید', 'Purchasing', true),
    (p_project_id, 'project_accountant', 'Project Accountant', 'Project Accountant', 'حسابدار پروژه', 'Financial reporting and invoices', true),
    (p_project_id, 'planning_engineer', 'Planning Engineer', 'Planning Engineer', 'مهندس برنامه‌ریزی', 'Schedule planning', true),
    (p_project_id, 'document_controller', 'Document Controller', 'Document Controller', 'مسئول مستندات', 'Document control', true),
    (p_project_id, 'foreman', 'Foreman', 'Foreman', 'سرکارگر', 'Field crew lead', true),
    (p_project_id, 'contractor', 'Contractor', 'Contractor', 'پیمانکار', 'Contractor rep', true),
    (p_project_id, 'subcontractor', 'Subcontractor', 'Subcontractor', 'پیمانکار جزء', 'Subcontractor access', true),
    (p_project_id, 'finance_admin', 'Finance/Admin Officer', 'Finance/Admin Officer', 'مسئول مالی/اداری', 'Finance admin', true),
    (p_project_id, 'equipment_manager', 'Equipment Manager', 'Equipment Manager', 'مدیر تجهیزات', 'Equipment allocation', true),
    (p_project_id, 'security', 'Security', 'Security', 'حراست', 'Site security', true),
    (p_project_id, 'worker', 'Worker', 'Worker', 'کارگر', 'Field worker', true),
    (p_project_id, 'visitor', 'Visitor / Temporary Access', 'Visitor / Temporary Access', 'بازدیدکننده', 'Temporary access', true)
  ON CONFLICT (project_id, key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- 2) Operational package enrichment columns (add one-by-one for older Postgres)
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS ops_status TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS location_text TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS planned_qty NUMERIC;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS uom_text TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS crew_text TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS payment_flag TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS payment_flag_reason TEXT;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS payment_flag_owner UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.site_ops_operational_tasks(id) ON DELETE SET NULL;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS pm_risk_acknowledged BOOLEAN;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS pm_acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS pm_acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS enriched_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.site_ops_operational_tasks ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

UPDATE public.site_ops_operational_tasks
SET ops_status = COALESCE(ops_status, 'Draft'),
    payment_flag = COALESCE(payment_flag, 'NotForPayment'),
    pm_risk_acknowledged = COALESCE(pm_risk_acknowledged, false);

ALTER TABLE public.site_ops_operational_tasks
  ALTER COLUMN ops_status SET DEFAULT 'Draft',
  ALTER COLUMN payment_flag SET DEFAULT 'NotForPayment',
  ALTER COLUMN pm_risk_acknowledged SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_ops_operational_tasks_ops_status_check'
  ) THEN
    ALTER TABLE public.site_ops_operational_tasks
      ADD CONSTRAINT site_ops_operational_tasks_ops_status_check
      CHECK (ops_status IN ('Draft', 'Ready', 'InProgress', 'Partial', 'Done', 'Blocked'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_ops_operational_tasks_payment_flag_check'
  ) THEN
    ALTER TABLE public.site_ops_operational_tasks
      ADD CONSTRAINT site_ops_operational_tasks_payment_flag_check
      CHECK (payment_flag IN ('PaymentReady', 'QuantityIncomplete', 'NeedsChangeReview', 'NotForPayment'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_ops_ops_tasks_payment
  ON public.site_ops_operational_tasks(project_id, payment_flag)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_site_ops_ops_tasks_parent
  ON public.site_ops_operational_tasks(parent_id);

-- 3) Blockers
CREATE TABLE IF NOT EXISTS public.site_ops_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  operational_task_id UUID NOT NULL REFERENCES public.site_ops_operational_tasks(id) ON DELETE CASCADE,
  plan_date DATE,
  blocker_type TEXT NOT NULL DEFAULT 'other'
    CHECK (blocker_type IN ('material', 'drawing', 'access', 'quantity_gap', 'other')),
  note TEXT NOT NULL DEFAULT '',
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_ops_blockers_project_open
  ON public.site_ops_blockers(project_id, is_open, created_at DESC);

-- 4) Approvals / PM acknowledgements
CREATE TABLE IF NOT EXISTS public.site_ops_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approver_role TEXT NOT NULL DEFAULT 'PM',
  decision TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED', 'ACKNOWLEDGED')),
  note TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_ops_approvals_project
  ON public.site_ops_approvals(project_id, decision, created_at DESC);

ALTER TABLE public.site_ops_role_grants DROP CONSTRAINT IF EXISTS site_ops_role_grants_role_check;
ALTER TABLE public.site_ops_role_grants
  ADD CONSTRAINT site_ops_role_grants_role_check
  CHECK (role IN (
    'PROJECT_CONTROLS', 'PLANNER', 'SITE_MANAGER', 'SUPERVISOR',
    'TECHNICAL_OFFICE', 'HSE', 'WAREHOUSE', 'GUARD', 'VIEWER', 'PM'
  ));

ALTER TABLE public.site_ops_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_ops_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_ops_blockers_select ON public.site_ops_blockers;
CREATE POLICY site_ops_blockers_select ON public.site_ops_blockers
  FOR SELECT TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS site_ops_blockers_write ON public.site_ops_blockers;
CREATE POLICY site_ops_blockers_write ON public.site_ops_blockers
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS site_ops_approvals_select ON public.site_ops_approvals;
CREATE POLICY site_ops_approvals_select ON public.site_ops_approvals
  FOR SELECT TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS site_ops_approvals_write ON public.site_ops_approvals;
CREATE POLICY site_ops_approvals_write ON public.site_ops_approvals
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));
