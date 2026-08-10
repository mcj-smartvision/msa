-- Add project_accountant position to seed + backfill existing projects
-- Run after migration 36

-- Backfill for all existing projects
INSERT INTO public.positions (project_id, key, title, name_en, name_fa, description, is_active)
SELECT
  p.id,
  'project_accountant',
  'Project Accountant',
  'Project Accountant',
  'حسابدار پروژه',
  'Project costs, client invoices, cash-in, and financial reporting.',
  true
FROM public.projects p
ON CONFLICT (project_id, key) DO NOTHING;

-- Update seed RPC to include accountant on new projects
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
