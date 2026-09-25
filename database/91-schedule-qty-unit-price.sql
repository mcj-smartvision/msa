-- Ensure commercial columns for مقدار / قیمت واحد / واحد / قیمت کل on schedule tasks.
-- Run once in Supabase SQL Editor, then hard-refresh the app.

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 3);

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی';

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS uom TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_tasks_quantity_certainty_check'
  ) THEN
    ALTER TABLE public.project_tasks
      ADD CONSTRAINT project_tasks_quantity_certainty_check
      CHECK (quantity_certainty IN ('حدودی', 'قطعی'));
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END
$$;

COMMENT ON COLUMN public.project_tasks.quantity IS
  'Commercial quantity — قیمت کل = quantity × unit_price';
COMMENT ON COLUMN public.project_tasks.unit_price IS
  'Unit price — قیمت کل = quantity × unit_price';
COMMENT ON COLUMN public.project_tasks.uom IS
  'Unit of measure inside مقدار column';

NOTIFY pgrst, 'reload schema';
