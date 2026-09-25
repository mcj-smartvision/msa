-- Add quantity on project_tasks if hotfix 88 was already applied earlier.
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 3);

COMMENT ON COLUMN public.project_tasks.quantity IS
  'Commercial quantity for schedule leaf activities (editable in ویرایش برنامه).';

NOTIFY pgrst, 'reload schema';
