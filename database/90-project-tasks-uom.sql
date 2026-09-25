-- Unit of measure on MSP leaf activities (shown inside مقدار column).
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS uom TEXT;

COMMENT ON COLUMN public.project_tasks.uom IS
  'Commercial unit of measure for schedule leaf activities (editable inside مقدار).';

NOTIFY pgrst, 'reload schema';
