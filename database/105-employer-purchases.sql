-- =====================================================
-- Employer purchases — خرید کارفرمایی
-- Run once in Supabase SQL Editor.
--
-- Goods the employer buys for the project. Each purchase is shared among one or more schedule
-- activities by percent (one activity = 100 %); the shares add up to 100 % (checked by the API).
-- Amounts are whole toman. Allocations keep the activity's WBS and name, so a purchase still reads
-- correctly if the activity is later removed by a schedule re-import (task_id becomes null).
-- Project members read and write; system admins everywhere.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employer_purchases (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  purchase_date date        NOT NULL,
  item_name     text        NOT NULL CHECK (length(trim(item_name)) > 0),
  supplier      text,
  quantity      numeric,
  unit          text,
  unit_price    numeric     CHECK (unit_price IS NULL OR unit_price >= 0),
  amount        numeric     NOT NULL CHECK (amount >= 0),
  invoice_ref   text,
  description   text,
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employer_purchases_project_date
  ON public.employer_purchases(project_id, purchase_date);

CREATE TABLE IF NOT EXISTS public.employer_purchase_allocations (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id   uuid    NOT NULL REFERENCES public.employer_purchases(id) ON DELETE CASCADE,
  project_id    uuid    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id       uuid    REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  task_wbs      text,
  task_name     text    NOT NULL,
  share_percent numeric NOT NULL CHECK (share_percent > 0 AND share_percent <= 100)
);

CREATE INDEX IF NOT EXISTS idx_employer_purchase_allocations_purchase
  ON public.employer_purchase_allocations(purchase_id);
CREATE INDEX IF NOT EXISTS idx_employer_purchase_allocations_task
  ON public.employer_purchase_allocations(task_id);

ALTER TABLE public.employer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_purchase_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employer_purchases_all ON public.employer_purchases;
CREATE POLICY employer_purchases_all ON public.employer_purchases
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS employer_purchase_allocations_all ON public.employer_purchase_allocations;
CREATE POLICY employer_purchase_allocations_all ON public.employer_purchase_allocations
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_purchase_allocations TO authenticated;

COMMENT ON TABLE public.employer_purchases IS
  'خریدهای کارفرمایی پروژه (مبلغ به تومان)؛ سهم هر فعالیت برنامه در employer_purchase_allocations.';
COMMENT ON TABLE public.employer_purchase_allocations IS
  'سهم درصدی هر فعالیت برنامه از یک خرید کارفرمایی؛ جمع سهم‌های هر خرید ۱۰۰٪ است.';

NOTIFY pgrst, 'reload schema';
