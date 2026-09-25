-- Quantity certainty for imported activities and user-added sub-branches.

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی'
  CHECK (quantity_certainty IN ('حدودی', 'قطعی'));

ALTER TABLE public.workshop_packages
  ADD COLUMN IF NOT EXISTS quantity_certainty TEXT NOT NULL DEFAULT 'حدودی'
  CHECK (quantity_certainty IN ('حدودی', 'قطعی'));

COMMENT ON COLUMN public.project_tasks.quantity_certainty IS
  'Whether the activity quantity is approximate (حدودی) or final (قطعی).';
COMMENT ON COLUMN public.workshop_packages.quantity_certainty IS
  'Whether the user-added sub-branch quantity is approximate (حدودی) or final (قطعی).';

NOTIFY pgrst, 'reload schema';
