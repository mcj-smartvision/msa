-- =====================================================
-- Package progress history — اجازهٔ حذف گزارش یک روز
-- Run once in Supabase SQL Editor, on the development database only.
--
-- «بک‌گراند گزارش‌های روزانه» lets a project member clear one day's progress of a workshop
-- package (DELETE /api/supervisor/daily-progress). Without a DELETE policy RLS silently
-- removes nothing, so the same membership rule as SELECT/INSERT is applied to DELETE.
-- task_progress_updates already allows this through its FOR ALL policy.
-- =====================================================

DROP POLICY IF EXISTS package_progress_updates_delete ON public.package_progress_updates;
CREATE POLICY package_progress_updates_delete ON public.package_progress_updates
  FOR DELETE USING (public.is_project_member(project_id) OR public.is_system_admin());

GRANT DELETE ON public.package_progress_updates TO authenticated;

COMMENT ON TABLE public.package_progress_updates IS
  'تاریخچهٔ درصد پیشرفت فیزیکی بسته‌های کاری؛ با هر ثبت پیشرفت سرپرست یک ردیف اضافه می‌شود و عضو پروژه می‌تواند گزارش یک روز را حذف کند.';

NOTIFY pgrst, 'reload schema';
