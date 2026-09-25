-- One shared unit price for schedule and contractor statement views.

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0
  CHECK (unit_price >= 0);

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0
  CHECK (unit_price >= 0);

DO $$
BEGIN
  IF to_regclass('public.contractor_activity_statements') IS NOT NULL THEN
    UPDATE public.project_tasks task
    SET unit_price = statement.unit_price
    FROM public.contractor_activity_statements statement
    WHERE statement.project_id = task.project_id
      AND statement.entity_type = 'task'
      AND statement.entity_id = task.id
      AND statement.unit_price > 0;

    UPDATE public.workshop_packages package
    SET unit_price = statement.unit_price
    FROM public.contractor_activity_statements statement
    WHERE statement.project_id = package.project_id
      AND statement.entity_type = 'package'
      AND statement.entity_id = package.id
      AND statement.unit_price > 0;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
