-- =====================================================
-- Calculation ledger history — تاریخچهٔ «موشن حساب»
-- Run once in Supabase SQL Editor. Safe to re-run; existing data is not touched.
--
-- Each time a system admin opens a dashboard, the server records the computed result of each
-- traced metric (CPI, SPI(t), PPC, EAC, BAC …) with its full calculation trace (formula, inputs and
-- their source rows). A new row is written only when the result changed; the app keeps the last 12
-- rows per project + metric and deletes older ones.
-- Read: system admins only (the trace exposes source rows). Write: the server (service role) only.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.calc_trace_snapshots (
  id             bigserial   PRIMARY KEY,
  project_id     uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric         text        NOT NULL CHECK (char_length(metric) BETWEEN 1 AND 120),
  result         numeric,
  result_display text,
  status         text        NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'critical', 'insufficient')),
  trace          jsonb       NOT NULL,
  computed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calc_trace_snapshots_metric_idx
  ON public.calc_trace_snapshots (project_id, metric, computed_at DESC);

ALTER TABLE public.calc_trace_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calc_trace_snapshots_select ON public.calc_trace_snapshots;
CREATE POLICY calc_trace_snapshots_select ON public.calc_trace_snapshots
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

GRANT SELECT ON public.calc_trace_snapshots TO authenticated;
GRANT ALL ON public.calc_trace_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.calc_trace_snapshots_id_seq TO service_role;

COMMENT ON TABLE public.calc_trace_snapshots IS
  'تاریخچهٔ موشن حساب: نتیجه و ریز محاسبهٔ هر شاخص داشبورد (فقط ادمین سیستم). حداکثر 12 ردیف آخر هر شاخص نگه داشته می‌شود.';

NOTIFY pgrst, 'reload schema';
