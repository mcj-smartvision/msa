import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRelationType } from '@/shared/types/schedule'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'
import type { ForecastLink, ForecastTask } from '@/features/schedule/lib/progress-forecast'
import { fetchProgressHistory } from '@/features/schedule/lib/progress-history'
import { liveForecast } from '@/features/schedule/lib/replay-week-windows'
import { buildDailyReportActivitiesFromTree } from '@/features/supervisor/lib/daily-report-activities'
import { loadScheduleTree } from '@/features/workshop/lib/service'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { loadSiteWorkCalendar } from '@/features/holidays/lib/load-holidays'
import type { IsWorkday } from '@/features/holidays/lib/work-calendar'

type DateSpan = { start: string | null; finish: string | null }

/** The forecast window (start_current / finish_current), or the actual dates or percent from the reports. */
export type ForecastChange = { id: string; wbs: string | null } & (
  | { field: 'current' | 'actual'; from: DateSpan; to: DateSpan }
  | { field: 'percent'; from: number | null; to: number }
)

const num = (v: unknown): number | null => (v == null || !Number.isFinite(Number(v)) ? null : Number(v))

/** Project tasks (approved plan + stored progress) and dependency links in forecast form. */
export async function loadForecastInputs(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ rows: Record<string, unknown>[]; tasks: ForecastTask[]; links: ForecastLink[]; isWorkday: IsWorkday }> {
  const [tasksRes, depsRes, isWorkday] = await Promise.all([
    supabase
      .from('project_tasks')
      .select(
        'id, wbs_code, parent_id, is_summary, is_milestone, start_planned, finish_planned, start_current, finish_current, actual_start, actual_finish, percent_complete, physical_percent_complete'
      )
      .eq('project_id', projectId),
    supabase
      .from('task_dependencies')
      .select('predecessor_task_id, successor_task_id, relation_type, lag_days, lag_duration, lag_is_percentage')
      .eq('project_id', projectId),
    loadSiteWorkCalendar(supabase),
  ])
  if (tasksRes.error) throw new Error(tasksRes.error.message)
  if (depsRes.error) throw new Error(depsRes.error.message)
  const rows = (tasksRes.data ?? []) as Record<string, unknown>[]

  const tasks: ForecastTask[] = rows.map((r) => ({
    id: String(r.id),
    wbs: r.wbs_code ? String(r.wbs_code) : null,
    parentId: r.parent_id ? String(r.parent_id) : null,
    isSummary: r.is_summary === true,
    isMilestone: r.is_milestone === true,
    plannedStart: toIsoDateOnly((r.start_planned ?? r.start_current) as string | null),
    plannedFinish: toIsoDateOnly((r.finish_planned ?? r.finish_current) as string | null),
    actualStart: toIsoDateOnly(r.actual_start as string | null),
    actualFinish: toIsoDateOnly(r.actual_finish as string | null),
    percent: num(r.physical_percent_complete) ?? num(r.percent_complete) ?? 0,
  }))

  // Percent lags are left out, as in the CPM run.
  const links: ForecastLink[] = ((depsRes.data ?? []) as Record<string, unknown>[])
    .filter((d) => !d.lag_is_percentage)
    .map((d) => ({
      predecessorId: String(d.predecessor_task_id),
      successorId: String(d.successor_task_id),
      type: ((d.relation_type as string) || 'FS') as TaskRelationType,
      lagDays: num(d.lag_days) ?? Math.round((num(d.lag_duration) ?? 0) / DEFAULT_MSP_MINUTES_PER_DAY),
    }))
  return { rows, tasks, links, isWorkday }
}

/** Forecast inputs plus every daily-report activity and its report history. */
export async function loadReportedForecastInputs(supabase: SupabaseClient, projectId: string) {
  const [inputs, tree, entries] = await Promise.all([
    loadForecastInputs(supabase, projectId),
    loadScheduleTree(supabase, projectId),
    fetchProgressHistory(supabase, projectId),
  ])
  const activities = buildDailyReportActivitiesFromTree(tree.nodes, tree.orphanPackages).map((a) => ({
    id: a.id,
    taskId: a.parentTaskId ?? null,
    weight: a.progressWeight,
  }))
  return { ...inputs, activities, entries }
}

/**
 * Re-forecasts start_current / finish_current from the daily reports up to the end of the status date
 * (liveForecast — the same state the daily report background replays), and keeps every reported task's
 * percent, actual_start and actual_finish equal to its reports (first day above 0, day it reached 100).
 * The approved plan (start_planned / finish_planned) and the baseline are never touched. Returns what changed.
 */
export async function persistProgressForecast(
  supabase: SupabaseClient,
  projectId: string,
  options: { statusDate?: string; dryRun?: boolean } = {}
): Promise<ForecastChange[]> {
  const statusDate = options.statusDate ?? todayTehranIso()
  const { rows, tasks, links, isWorkday, activities, entries } = await loadReportedForecastInputs(supabase, projectId)
  const { forecast, reported } = liveForecast({ tasks, links, activities, entries, date: statusDate, isWorkday })
  const changes: ForecastChange[] = []
  for (const r of rows) {
    const id = String(r.id)
    const wbs = r.wbs_code ? String(r.wbs_code) : null
    const patch: Record<string, string | number | null> = {}

    const next = forecast.get(id)
    const curStart = toIsoDateOnly(r.start_current as string | null)
    const curFinish = toIsoDateOnly(r.finish_current as string | null)
    if (next && (curStart !== next.start || curFinish !== next.finish)) {
      changes.push({ id, wbs, field: 'current', from: { start: curStart, finish: curFinish }, to: next })
      patch.start_current = `${next.start}T12:00:00.000Z`
      patch.finish_current = `${next.finish}T12:00:00.000Z`
    }

    const actual = reported.get(id)
    const actualStart = toIsoDateOnly(r.actual_start as string | null)
    const actualFinish = toIsoDateOnly(r.actual_finish as string | null)
    if (actual && (actualStart !== actual.start || actualFinish !== actual.finish)) {
      changes.push({ id, wbs, field: 'actual', from: { start: actualStart, finish: actualFinish }, to: { start: actual.start, finish: actual.finish } })
      patch.actual_start = actual.start
      patch.actual_finish = actual.finish
    }

    // A task reported through its packages carries their weighted percent.
    const storedPercent = num(r.physical_percent_complete) ?? num(r.percent_complete)
    const percent = actual ? Math.round(actual.percent * 100) / 100 : null
    if (percent != null && (storedPercent !== percent || num(r.percent_complete) !== percent)) {
      changes.push({ id, wbs, field: 'percent', from: storedPercent, to: percent })
      patch.percent_complete = percent
      patch.physical_percent_complete = percent
    }

    if (options.dryRun || Object.keys(patch).length === 0) continue
    const { error } = await supabase.from('project_tasks').update(patch).eq('id', id).eq('project_id', projectId)
    if (error) throw new Error(error.message)
  }
  return changes
}
