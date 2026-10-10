import type { SupabaseClient } from '@supabase/supabase-js'
import { tehranDateIso } from '@/shared/lib/time/tehran'
import { CALC_TRACE_HISTORY_LIMIT, type CalcTraceMap, type CalcTracePoint } from './types'

type SnapshotRow = { id: number; metric: string; result: number | string | null; computed_at: string }

const MISSING_TABLE_NOTE = 'تاریخچه ذخیره نمی‌شود: جدول calc_trace_snapshots ساخته نشده (database/107-calc-trace-snapshots.sql را اجرا کنید).'

function toNumber(value: number | string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function sameResult(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9)
}

/**
 * Records each trace whose result changed since the last snapshot, keeps the last 12 per metric and
 * fills `history` / `previousPeriod`. `service` must be a service-role client; only call this for
 * system admins. History is best effort: a failure never breaks the dashboard response.
 */
export async function attachTraceHistory(
  service: SupabaseClient,
  projectId: string,
  traces: CalcTraceMap,
  todayIso: string
): Promise<CalcTraceMap> {
  const metrics = Object.keys(traces)
  if (metrics.length === 0) return traces
  const setNote = (note: string) => {
    for (const trace of Object.values(traces)) trace.historyNote = note
    return traces
  }

  const { data, error } = await service
    .from('calc_trace_snapshots')
    .select('id, metric, result, computed_at')
    .eq('project_id', projectId)
    .in('metric', metrics)
    .order('computed_at', { ascending: false })
    .limit(metrics.length * (CALC_TRACE_HISTORY_LIMIT + 2))
  if (error) {
    return setNote(/does not exist|schema cache|Could not find/i.test(error.message) ? MISSING_TABLE_NOTE : `خواندن تاریخچه ناموفق بود: ${error.message}`)
  }

  const byMetric = new Map<string, SnapshotRow[]>()
  for (const row of (data ?? []) as SnapshotRow[]) {
    const list = byMetric.get(row.metric) ?? []
    list.push(row)
    byMetric.set(row.metric, list)
  }

  const inserts: Record<string, unknown>[] = []
  const stale: number[] = []
  for (const metric of metrics) {
    const trace = traces[metric]!
    const rows = byMetric.get(metric) ?? []
    const changed = rows.length === 0 || !sameResult(toNumber(rows[0]!.result), trace.result)
    const past: CalcTracePoint[] = rows.map((r) => ({ result: toNumber(r.result), computedAt: r.computed_at }))
    const previous = past.find((p) => tehranDateIso(Date.parse(p.computedAt)) < todayIso) ?? null
    const kept = changed ? CALC_TRACE_HISTORY_LIMIT - 1 : CALC_TRACE_HISTORY_LIMIT
    stale.push(...rows.slice(kept).map((r) => r.id))
    const points = changed ? [{ result: trace.result, computedAt: trace.computedAt }, ...past] : past
    trace.history = points.slice(0, CALC_TRACE_HISTORY_LIMIT).reverse()
    trace.previousPeriod = previous
    if (changed) {
      const { history: _h, previousPeriod: _p, historyNote: _n, ...stored } = trace
      inserts.push({
        project_id: projectId,
        metric,
        result: trace.result,
        result_display: null,
        status: trace.status,
        trace: stored,
        computed_at: trace.computedAt,
      })
    }
  }

  if (inserts.length) {
    const { error: insertError } = await service.from('calc_trace_snapshots').insert(inserts)
    if (insertError) return setNote(`ثبت تاریخچه ناموفق بود: ${insertError.message}`)
  }
  if (stale.length) await service.from('calc_trace_snapshots').delete().in('id', stale)
  return traces
}
