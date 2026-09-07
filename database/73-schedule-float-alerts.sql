-- =====================================================
-- Float consumption alerts (بخش ۳)
-- Run once in Supabase SQL Editor after migration 72
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_alert_settings (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  near_critical_days NUMERIC NOT NULL DEFAULT 5,
  -- آستانه مصرف شناوری: روز شناوری در هفته (مثلاً ۳ = بیش از ۳ روز شناوری در ۷ روز تقویمی)
  fast_consumption_threshold NUMERIC NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_alert_settings IS 'آستانه‌های هشدار شناوری هر پروژه';
COMMENT ON COLUMN public.project_alert_settings.near_critical_days IS 'اگر 0 < float <= این مقدار → near_critical (پیش‌فرض ۵)';
COMMENT ON COLUMN public.project_alert_settings.fast_consumption_threshold IS 'مصرف شناوری هفتگی بیش از این مقدار → fast_consumption (پیش‌فرض ۳ روز/هفته)';

CREATE TABLE IF NOT EXISTS public.schedule_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN (
    'negative',
    'critical',
    'near_critical',
    'fast_consumption'
  )),
  message TEXT NOT NULL,
  total_float NUMERIC,
  consumption_rate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedule_alerts_project_open
  ON public.schedule_alerts(project_id, acknowledged, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_alerts_activity_day
  ON public.schedule_alerts(activity_id, severity, created_at DESC);

COMMENT ON TABLE public.schedule_alerts IS 'هشدارهای شناوری / مسیر بحرانی پس از محاسبه CPM';

ALTER TABLE public.project_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_alert_settings_select ON public.project_alert_settings;
CREATE POLICY project_alert_settings_select ON public.project_alert_settings
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS project_alert_settings_write ON public.project_alert_settings;
CREATE POLICY project_alert_settings_write ON public.project_alert_settings
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_alerts_select ON public.schedule_alerts;
CREATE POLICY schedule_alerts_select ON public.schedule_alerts
  FOR SELECT USING (public.is_project_member(project_id) OR public.is_system_admin());

DROP POLICY IF EXISTS schedule_alerts_write ON public.schedule_alerts;
CREATE POLICY schedule_alerts_write ON public.schedule_alerts
  FOR ALL USING (public.is_project_member(project_id) OR public.is_system_admin())
  WITH CHECK (public.is_project_member(project_id) OR public.is_system_admin());

NOTIFY pgrst, 'reload schema';
