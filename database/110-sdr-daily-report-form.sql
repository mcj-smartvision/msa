-- =====================================================
-- SDR — Structured Daily Report (فرم گزارش روزانه سرپرست)
-- Prefix: sdr_
-- Run once in Supabase SQL Editor on the DEVELOPMENT database only.
-- Does NOT alter daily_reports, daily_report_activities, task_progress_updates,
-- package_progress_updates, site_ops_*, or any existing supervisor panel tables.
--
-- Reversible: see DOWN section at the bottom of this file.
-- =====================================================

-- -----------------------------------------------------
-- UP
-- -----------------------------------------------------

-- Header
CREATE TABLE IF NOT EXISTS public.sdr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_no TEXT NOT NULL,
  weekday TEXT,
  shift_start TIME,
  shift_end TIME,
  site_status TEXT NOT NULL DEFAULT 'normal'
    CHECK (site_status IN ('normal', 'half_closed', 'closed')),
  site_status_reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved')),
  -- Voice / AI audit
  transcript TEXT NOT NULL DEFAULT '',
  extra_notes TEXT NOT NULL DEFAULT '',
  ai_last_parse JSONB,
  manual_touched JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional soft link to legacy textual daily_reports (no change to that table)
  legacy_daily_report_id UUID REFERENCES public.daily_reports(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sdr_reports_unique_day UNIQUE (project_id, report_date, site_supervisor_id)
);

CREATE INDEX IF NOT EXISTS idx_sdr_reports_project_date
  ON public.sdr_reports(project_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_sdr_reports_supervisor
  ON public.sdr_reports(site_supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_sdr_reports_status
  ON public.sdr_reports(project_id, status);

COMMENT ON TABLE public.sdr_reports IS
  'سرآیند فرم ساختاریافته گزارش روزانه سرپرست (مسیر /dashboard/daily-report). جدا از daily_reports.';
COMMENT ON COLUMN public.sdr_reports.transcript IS
  'متن کامل ویس(های) پیاده‌شده؛ برای ردیابی و رفع اشتباه نگه داشته می‌شود.';
COMMENT ON COLUMN public.sdr_reports.manual_touched IS
  'نقشهٔ فیلدهایی که کاربر دستی ویرایش کرده؛ ویس بعدی آن‌ها را بازنویسی نمی‌کند.';
COMMENT ON COLUMN public.sdr_reports.legacy_daily_report_id IS
  'اتصال اختیاری به daily_reports قدیمی؛ بدون تغییر آن جدول.';

-- Weather (1:1)
CREATE TABLE IF NOT EXISTS public.sdr_weather (
  report_id UUID PRIMARY KEY REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  temperature_c NUMERIC,
  precipitation TEXT,
  wind TEXT,
  frost BOOLEAN,
  affects_work BOOLEAN,
  affects_work_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities (list)
CREATE TABLE IF NOT EXISTS public.sdr_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.workshop_packages(id) ON DELETE SET NULL,
  activity_label TEXT,
  location TEXT,
  uom TEXT,
  planned_qty_today NUMERIC,
  actual_qty_today NUMERIC,
  cumulative_qty NUMERIC,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'finished', 'stopped')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sdr_activities_task_or_label CHECK (task_id IS NOT NULL OR package_id IS NOT NULL OR activity_label IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sdr_activities_report ON public.sdr_activities(report_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sdr_activities_task ON public.sdr_activities(task_id);

-- Manpower (list; optional link to activity row)
CREATE TABLE IF NOT EXISTS public.sdr_manpower (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activity_row_id UUID REFERENCES public.sdr_activities(id) ON DELETE SET NULL,
  specialty TEXT,
  contractor_or_crew TEXT,
  headcount INTEGER NOT NULL DEFAULT 0 CHECK (headcount >= 0),
  work_hours NUMERIC NOT NULL DEFAULT 0 CHECK (work_hours >= 0),
  overtime_hours NUMERIC NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
  absentees INTEGER NOT NULL DEFAULT 0 CHECK (absentees >= 0),
  person_hours NUMERIC GENERATED ALWAYS AS (headcount * (work_hours + overtime_hours)) STORED,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_manpower_report ON public.sdr_manpower(report_id, sort_order);

-- Equipment
CREATE TABLE IF NOT EXISTS public.sdr_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activity_row_id UUID REFERENCES public.sdr_activities(id) ON DELETE SET NULL,
  equipment_type TEXT,
  plate_or_number TEXT,
  ownership TEXT CHECK (ownership IS NULL OR ownership IN ('owned', 'rented')),
  useful_hours NUMERIC CHECK (useful_hours IS NULL OR useful_hours >= 0),
  idle_hours NUMERIC CHECK (idle_hours IS NULL OR idle_hours >= 0),
  breakdown_hours NUMERIC CHECK (breakdown_hours IS NULL OR breakdown_hours >= 0),
  breakdown_reason TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_equipment_report ON public.sdr_equipment(report_id, sort_order);

-- Materials: inbound / consumption / shortages / forward needs
CREATE TABLE IF NOT EXISTS public.sdr_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('inbound', 'consumption', 'shortage', 'forward_need')),
  material_type TEXT,
  quantity NUMERIC,
  uom TEXT,
  supplier TEXT,
  waybill_no TEXT,
  note TEXT,
  horizon_days INTEGER CHECK (horizon_days IS NULL OR horizon_days BETWEEN 3 AND 7),
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_materials_report ON public.sdr_materials(report_id, kind, sort_order);

-- Quality (single row per report; sections as text/json)
CREATE TABLE IF NOT EXISTS public.sdr_quality (
  report_id UUID PRIMARY KEY REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  inspections_done TEXT,
  sampling_tests TEXT,
  new_ncr TEXT,
  corrective_work TEXT,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HSE
CREATE TABLE IF NOT EXISTS public.sdr_hse (
  report_id UUID PRIMARY KEY REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  incident TEXT,
  near_miss TEXT,
  toolbox_talk TEXT,
  safety_violation TEXT,
  special_work_permit TEXT,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issues / challenges
CREATE TABLE IF NOT EXISTS public.sdr_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activity_row_id UUID REFERENCES public.sdr_activities(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT CHECK (
    category IS NULL OR category IN (
      'drawing', 'material', 'manpower', 'equipment', 'client_approval',
      'weather', 'access', 'safety', 'finance', 'other'
    )
  ),
  estimated_delay_days NUMERIC CHECK (estimated_delay_days IS NULL OR estimated_delay_days >= 0),
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'tracking', 'closed')),
  -- Carry-forward from previous day's open issue
  carried_from_issue_id UUID REFERENCES public.sdr_issues(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_issues_report ON public.sdr_issues(report_id, status, sort_order);

-- Delays / stoppages
CREATE TABLE IF NOT EXISTS public.sdr_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activity_row_id UUID REFERENCES public.sdr_activities(id) ON DELETE SET NULL,
  reason TEXT,
  hours_lost NUMERIC CHECK (hours_lost IS NULL OR hours_lost >= 0),
  days_lost NUMERIC CHECK (days_lost IS NULL OR days_lost >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_delays_report ON public.sdr_delays(report_id, sort_order);

-- Instructions / correspondence
CREATE TABLE IF NOT EXISTS public.sdr_correspondence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  kind TEXT CHECK (
    kind IS NULL OR kind IN ('client_instruction', 'rfi', 'change_order', 'drawing_revision')
  ),
  body TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_correspondence_report ON public.sdr_correspondence(report_id, sort_order);

-- Visits
CREATE TABLE IF NOT EXISTS public.sdr_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  visitor_name TEXT,
  visitor_role TEXT,
  subject TEXT,
  outcome TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_visits_report ON public.sdr_visits(report_id, sort_order);

-- Tomorrow plan
CREATE TABLE IF NOT EXISTS public.sdr_tomorrow (
  report_id UUID PRIMARY KEY REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activities_plan TEXT,
  manpower_needed TEXT,
  equipment_needed TEXT,
  blockers TEXT,
  needs_from_others TEXT,
  ai_confidence TEXT CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos (storage path + tag)
CREATE TABLE IF NOT EXISTS public.sdr_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sdr_reports(id) ON DELETE CASCADE,
  activity_row_id UUID REFERENCES public.sdr_activities(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  location_tag TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_photos_report ON public.sdr_photos(report_id, sort_order);

-- -----------------------------------------------------
-- RLS
-- Supervisor: member + own draft/submitted rows editable while draft
-- Project members: can SELECT submitted/approved; managers can approve
-- System admin: full
-- -----------------------------------------------------

ALTER TABLE public.sdr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_weather ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_manpower ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_hse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_tomorrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdr_photos ENABLE ROW LEVEL SECURITY;

-- Header policies
DROP POLICY IF EXISTS sdr_reports_select ON public.sdr_reports;
CREATE POLICY sdr_reports_select ON public.sdr_reports
  FOR SELECT USING (
    public.is_system_admin()
    OR (
      public.is_project_member(project_id)
      AND (
        site_supervisor_id = auth.uid()
        OR status IN ('submitted', 'approved')
      )
    )
  );

DROP POLICY IF EXISTS sdr_reports_insert ON public.sdr_reports;
CREATE POLICY sdr_reports_insert ON public.sdr_reports
  FOR INSERT WITH CHECK (
    (public.is_project_member(project_id) OR public.is_system_admin())
    AND site_supervisor_id = auth.uid()
  );

DROP POLICY IF EXISTS sdr_reports_update ON public.sdr_reports;
CREATE POLICY sdr_reports_update ON public.sdr_reports
  FOR UPDATE USING (
    public.is_system_admin()
    OR (
      public.is_project_member(project_id)
      AND (
        (site_supervisor_id = auth.uid() AND status = 'draft')
        OR status IN ('submitted', 'approved')
      )
    )
  );

DROP POLICY IF EXISTS sdr_reports_delete ON public.sdr_reports;
CREATE POLICY sdr_reports_delete ON public.sdr_reports
  FOR DELETE USING (
    public.is_system_admin()
    OR (public.is_project_member(project_id) AND site_supervisor_id = auth.uid() AND status = 'draft')
  );

-- Child-row helper: access via parent report
-- SELECT for children
DROP POLICY IF EXISTS sdr_weather_select ON public.sdr_weather;
CREATE POLICY sdr_weather_select ON public.sdr_weather
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sdr_reports r
      WHERE r.id = report_id
        AND (
          public.is_system_admin()
          OR (
            public.is_project_member(r.project_id)
            AND (r.site_supervisor_id = auth.uid() OR r.status IN ('submitted', 'approved'))
          )
        )
    )
  );

DROP POLICY IF EXISTS sdr_weather_write ON public.sdr_weather;
CREATE POLICY sdr_weather_write ON public.sdr_weather
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sdr_reports r
      WHERE r.id = report_id
        AND (
          public.is_system_admin()
          OR (public.is_project_member(r.project_id) AND r.site_supervisor_id = auth.uid() AND r.status = 'draft')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sdr_reports r
      WHERE r.id = report_id
        AND (
          public.is_system_admin()
          OR (public.is_project_member(r.project_id) AND r.site_supervisor_id = auth.uid() AND r.status = 'draft')
        )
    )
  );

-- Reuse the same pattern for list/child tables via a macro-like block
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sdr_activities',
    'sdr_manpower',
    'sdr_equipment',
    'sdr_materials',
    'sdr_quality',
    'sdr_hse',
    'sdr_issues',
    'sdr_delays',
    'sdr_correspondence',
    'sdr_visits',
    'sdr_tomorrow',
    'sdr_photos'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.sdr_reports r
          WHERE r.id = report_id
            AND (
              public.is_system_admin()
              OR (
                public.is_project_member(r.project_id)
                AND (r.site_supervisor_id = auth.uid() OR r.status IN (''submitted'', ''approved''))
              )
            )
        )
      )', t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write ON public.%I FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.sdr_reports r
          WHERE r.id = report_id
            AND (
              public.is_system_admin()
              OR (public.is_project_member(r.project_id) AND r.site_supervisor_id = auth.uid() AND r.status = ''draft'')
            )
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.sdr_reports r
          WHERE r.id = report_id
            AND (
              public.is_system_admin()
              OR (public.is_project_member(r.project_id) AND r.site_supervisor_id = auth.uid() AND r.status = ''draft'')
            )
        )
      )', t, t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.sdr_reports,
  public.sdr_weather,
  public.sdr_activities,
  public.sdr_manpower,
  public.sdr_equipment,
  public.sdr_materials,
  public.sdr_quality,
  public.sdr_hse,
  public.sdr_issues,
  public.sdr_delays,
  public.sdr_correspondence,
  public.sdr_visits,
  public.sdr_tomorrow,
  public.sdr_photos
TO authenticated;

GRANT ALL ON
  public.sdr_reports,
  public.sdr_weather,
  public.sdr_activities,
  public.sdr_manpower,
  public.sdr_equipment,
  public.sdr_materials,
  public.sdr_quality,
  public.sdr_hse,
  public.sdr_issues,
  public.sdr_delays,
  public.sdr_correspondence,
  public.sdr_visits,
  public.sdr_tomorrow,
  public.sdr_photos
TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'sdr daily report form UP applied' AS status;

-- =====================================================
-- DOWN (run manually to fully reverse this migration)
-- Does not touch any non-sdr_ table.
-- =====================================================
/*
DROP POLICY IF EXISTS sdr_reports_select ON public.sdr_reports;
DROP POLICY IF EXISTS sdr_reports_insert ON public.sdr_reports;
DROP POLICY IF EXISTS sdr_reports_update ON public.sdr_reports;
DROP POLICY IF EXISTS sdr_reports_delete ON public.sdr_reports;
DROP POLICY IF EXISTS sdr_weather_select ON public.sdr_weather;
DROP POLICY IF EXISTS sdr_weather_write ON public.sdr_weather;

DROP TABLE IF EXISTS public.sdr_photos CASCADE;
DROP TABLE IF EXISTS public.sdr_tomorrow CASCADE;
DROP TABLE IF EXISTS public.sdr_visits CASCADE;
DROP TABLE IF EXISTS public.sdr_correspondence CASCADE;
DROP TABLE IF EXISTS public.sdr_delays CASCADE;
DROP TABLE IF EXISTS public.sdr_issues CASCADE;
DROP TABLE IF EXISTS public.sdr_hse CASCADE;
DROP TABLE IF EXISTS public.sdr_quality CASCADE;
DROP TABLE IF EXISTS public.sdr_materials CASCADE;
DROP TABLE IF EXISTS public.sdr_equipment CASCADE;
DROP TABLE IF EXISTS public.sdr_manpower CASCADE;
DROP TABLE IF EXISTS public.sdr_activities CASCADE;
DROP TABLE IF EXISTS public.sdr_weather CASCADE;
DROP TABLE IF EXISTS public.sdr_reports CASCADE;

NOTIFY pgrst, 'reload schema';
*/
