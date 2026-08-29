-- Optional project creation fields for admin quick-create form
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_manager_name TEXT;
