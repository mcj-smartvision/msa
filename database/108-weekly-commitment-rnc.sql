-- =====================================================
-- Weekly commitment RNC — علت عدم تحقق تعهد هفتگی (PPC باینری)
-- Run once in Supabase SQL Editor. Safe to re-run; existing data is not touched.
--
-- One row per activity and site week (Saturday–Thursday) whose schedule-based commitment was missed.
-- The commitment and its 0/1 score are computed by the app (project store weekly engine) from the
-- schedule and the daily reports; only the reason recorded after evaluation opens (Thursday 16:00
-- Tehran) is stored here.
--   activity_id : daily-report activity id, `schedule:<project_tasks.id>` or `package:<workshop_packages.id>`
--   week_start  : the Saturday of the week
--   category    : same categories as wwp_commitments.root_cause_category
-- Read: project members and system admins. Written only through /api/project-store/rnc (service role),
-- which checks membership and the evaluation time.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.weekly_commitment_rnc (
  id           bigserial   PRIMARY KEY,
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id  text        NOT NULL CHECK (activity_id ~ '^(schedule|package):[0-9a-fA-F-]{36}$'),
  week_start   date        NOT NULL CHECK (extract(isodow FROM week_start) = 6),
  category     text        NOT NULL CHECK (category IN (
    'materials', 'crew', 'equipment', 'permit_approval', 'design_info', 'prerequisite_work',
    'weather', 'site_access', 'payment', 'qc_rework', 'other'
  )),
  note         text        CHECK (note IS NULL OR char_length(note) <= 500),
  weekly_target numeric,
  weekly_actual numeric,
  recorded_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_commitment_rnc_other_note CHECK (category <> 'other' OR coalesce(btrim(note), '') <> ''),
  CONSTRAINT weekly_commitment_rnc_unique UNIQUE (project_id, activity_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_commitment_rnc_project_week
  ON public.weekly_commitment_rnc (project_id, week_start DESC);

ALTER TABLE public.weekly_commitment_rnc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_commitment_rnc_select ON public.weekly_commitment_rnc;
CREATE POLICY weekly_commitment_rnc_select ON public.weekly_commitment_rnc
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id) OR public.is_system_admin());

GRANT SELECT ON public.weekly_commitment_rnc TO authenticated;
GRANT ALL ON public.weekly_commitment_rnc TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.weekly_commitment_rnc_id_seq TO service_role;

COMMENT ON TABLE public.weekly_commitment_rnc IS
  'علت عدم تحقق تعهد هفتگی هر فعالیت (هفتهٔ شنبه تا پنجشنبه). تعهد و امتیاز 0/1 در برنامه محاسبه می‌شود؛ فقط علت اینجا ذخیره می‌شود.';

NOTIFY pgrst, 'reload schema';
