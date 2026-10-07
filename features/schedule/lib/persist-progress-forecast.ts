import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRelationType } from '@/shared/types/schedule'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'
import { forecastSchedule, type ForecastLink, type ForecastTask } from '@/features/schedule/lib/progress-forecast'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { loadSiteWorkCalendar } from '@/features/holidays/lib/load-holidays'
import type { IsWorkday } from '@/features/holidays/lib/work-calendar'

export interface ForecastChange {
  id: string
  wbs: string | null
  from: { start: string | null; finish: string | null }
  to: { start: string; finish: string }
}

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

/**
 * Re-forecasts start_current / finish_current from the reported progress (see forecastSchedule).
 * The approved plan (start_planned / finish_planned) and the baseline are never touched; editing the
 * schedule writes both, so the forecast restarts from the new plan. Returns the tasks that moved.
 */
export async function persistProgressForecast(
  supabase: SupabaseClient,
  projectId: string,
  options: { statusDate?: string; dryRun?: boolean } = {}
): Promise<ForecastChange[]> {
  const statusDate = options.statusDate ?? todayTehranIso()
  const { rows, tasks, links, isWorkday } = await loadForecastInputs(supabase, projectId)
  const forecast = forecastSchedule({ tasks, links, statusDate, isWorkday })
  const changes: ForecastChange[] = []
  for (const r of rows) {
    const next = forecast.get(String(r.id))
    if (!next) continue
    const curStart = toIsoDateOnly(r.start_current as string | null)
    const curFinish = toIsoDateOnly(r.finish_current as string | null)
    if (curStart === next.start && curFinish === next.finish) continue
    changes.push({
      id: String(r.id),
      wbs: r.wbs_code ? String(r.wbs_code) : null,
      from: { start: curStart, finish: curFinish },
      to: next,
    })
    if (options.dryRun) continue
    const { error } = await supabase
      .from('project_tasks')
      .update({ start_current: `${next.start}T12:00:00.000Z`, finish_current: `${next.finish}T12:00:00.000Z` })
      .eq('id', String(r.id))
      .eq('project_id', projectId)
    if (error) throw new Error(error.message)
  }
  return changes
}
