-- Activity weight (وزن) from MSP custom field / ExtendedAttribute
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS schedule_weight NUMERIC;

COMMENT ON COLUMN public.project_tasks.schedule_weight IS 'وزن فعالیت از MSP (فیلد سفارشی ExtendedAttribute)';
