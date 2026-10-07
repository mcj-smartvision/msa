-- =====================================================
-- Holidays — تعطیلات (organization-wide)
-- Run once in Supabase SQL Editor.
--
-- Friday is always a day off in the site calendar; these rows add more days off:
--   weekly         : every week on the weekday of start_date, from start_date until end_date (or for good)
--   official       : an official occasion, start_date … end_date (end_date null = one day)
--   organizational : a company day off, same as official
-- Inactive rows are kept but ignored. Dates are Gregorian; the UI shows them in Jalali.
-- Everyone signed in reads them (header calendar, schedule forecast); system admins and anyone who is
-- project manager on an active project write them.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.holidays (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        NOT NULL CHECK (type IN ('weekly', 'official', 'organizational')),
  start_date  date        NOT NULL,
  end_date    date,
  title       text        NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holidays_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_start_date ON public.holidays(start_date);

CREATE OR REPLACE FUNCTION public.can_manage_holidays()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_system_admin() OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.member_positions mp ON mp.project_member_id = pm.id
    JOIN public.positions pos ON pos.id = mp.position_id
    WHERE pm.user_id = auth.uid()
      AND pm.is_active
      AND pos.is_active
      AND pos.project_id = pm.project_id
      AND pos.key = 'project_manager'
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_holidays() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_holidays() TO authenticated, service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holidays_select ON public.holidays;
CREATE POLICY holidays_select ON public.holidays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS holidays_insert ON public.holidays;
CREATE POLICY holidays_insert ON public.holidays
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_holidays());

DROP POLICY IF EXISTS holidays_update ON public.holidays;
CREATE POLICY holidays_update ON public.holidays
  FOR UPDATE TO authenticated USING (public.can_manage_holidays()) WITH CHECK (public.can_manage_holidays());

DROP POLICY IF EXISTS holidays_delete ON public.holidays;
CREATE POLICY holidays_delete ON public.holidays
  FOR DELETE TO authenticated USING (public.can_manage_holidays());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;

COMMENT ON TABLE public.holidays IS
  'تعطیلات سازمان (هفتگی، رسمی، سازمانی)؛ جمعه همیشه تعطیل است. در تقویم هدر و پیش‌بینی برنامه اثر دارد.';

NOTIFY pgrst, 'reload schema';
