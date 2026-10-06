import type { SupabaseClient } from '@supabase/supabase-js'
import { enumerateProjectJalaliMonths, projectDateSpan } from '@/features/schedule/lib/monthly-deducted-weight'
import { buildProgressAndOverhead } from '@/features/schedule/lib/month-progress-overhead'
import { todayIso } from '@/features/schedule/lib/progress-snapshots'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'

type TaskRow = {
  id: string
  is_summary: boolean | null
  physical_weight: number | null
  schedule_weight: number | null
  start_current: string | null
  finish_current: string | null
  start_planned: string | null
  finish_planned: string | null
  baseline_start: string | null
  baseline_finish: string | null
}

function weightOf(task: TaskRow): number {
  const raw = task.physical_weight ?? task.schedule_weight
  return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0
}

function scheduleStart(task: TaskRow): string | null {
  return (
    toIsoDateOnly(task.baseline_start) ??
    toIsoDateOnly(task.start_planned) ??
    toIsoDateOnly(task.start_current)
  )
}

function scheduleFinish(task: TaskRow): string | null {
  return (
    toIsoDateOnly(task.baseline_finish) ??
    toIsoDateOnly(task.finish_planned) ??
    toIsoDateOnly(task.finish_current)
  )
}

/**
 * Writes activity_month_allocations and the overhead columns on monthly_project_progress.
 * Reads project_monthly_overhead; months with no row cost 0.
 */
export async function persistMonthProgressOverhead(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ months: number; activities: number }> {
  const { data: taskData, error: taskError } = await supabase
    .from('project_tasks')
    .select(
      'id, is_summary, physical_weight, schedule_weight, start_current, finish_current, start_planned, finish_planned, baseline_start, baseline_finish'
    )
    .eq('project_id', projectId)
  if (taskError) throw new Error(taskError.message)
  const tasks = ((taskData ?? []) as TaskRow[]).filter((task) => !task.is_summary)

  const { data: snapshotData, error: snapshotError } = await supabase
    .from('progress_snapshots')
    .select('activity_id, snapshot_month, cumulative_percent')
    .eq('project_id', projectId)
  if (snapshotError) throw new Error(snapshotError.message)

  const { data: overheadData, error: overheadError } = await supabase
    .from('project_monthly_overhead')
    .select('month, monthly_overhead_cost')
    .eq('project_id', projectId)
  if (overheadError) throw new Error(overheadError.message)

  const snapshots = new Map<string, Map<string, number>>()
  for (const row of snapshotData ?? []) {
    const activityId = String((row as { activity_id: string }).activity_id)
    const month = String((row as { snapshot_month: string }).snapshot_month).slice(0, 10)
    const percent = Number((row as { cumulative_percent: number }).cumulative_percent) || 0
    const byMonth = snapshots.get(activityId) ?? new Map<string, number>()
    byMonth.set(month, percent)
    snapshots.set(activityId, byMonth)
  }

  const overheadByMonth = new Map<string, number>()
  for (const row of overheadData ?? []) {
    const month = String((row as { month: string }).month).slice(0, 10)
    overheadByMonth.set(month, Number((row as { monthly_overhead_cost: number }).monthly_overhead_cost) || 0)
  }

  const span = projectDateSpan([
    ...tasks.map((task) => ({ startDate: scheduleStart(task), finishDate: scheduleFinish(task) })),
    ...[...snapshots.values()].flatMap((byMonth) =>
      [...byMonth.keys()].map((month) => ({ startDate: month, finishDate: month }))
    ),
    ...[...overheadByMonth.keys()].map((month) => ({ startDate: month, finishDate: month })),
  ])
  const today = todayIso()
  const rangeStart = span.start && span.start < today ? span.start : today
  const rangeFinish = span.finish && span.finish > today ? span.finish : today
  const months = enumerateProjectJalaliMonths(rangeStart, rangeFinish)
  if (months.length === 0 || tasks.length === 0) return { months: 0, activities: 0 }

  const built = buildProgressAndOverhead(
    tasks.map((task) => {
      const byMonth = snapshots.get(task.id)
      return {
        activityId: task.id,
        weightFactor: weightOf(task),
        start: scheduleStart(task),
        finish: scheduleFinish(task),
        actualCumulativePercent: months.map((month) =>
          byMonth?.has(month.startIso) ? byMonth.get(month.startIso)! : null
        ),
      }
    }),
    months,
    months.map((month) => overheadByMonth.get(month.startIso) ?? 0)
  )

  const { error: deleteError } = await supabase
    .from('activity_month_allocations')
    .delete()
    .eq('project_id', projectId)
  if (deleteError) throw new Error(deleteError.message)

  const payload = built.activities.map((row) => ({
    project_id: projectId,
    activity_id: row.activityId,
    month: row.month,
    weight_factor: row.weightFactor,
    cumulative_planned_progress: row.cumulativePlannedProgress,
    planned_monthly_progress: row.plannedMonthlyProgress,
    planned_weight_month: row.plannedWeightMonth,
    cumulative_actual_progress: row.cumulativeActualProgress,
    actual_monthly_progress: row.actualMonthlyProgress,
    earned_weight_month: row.earnedWeightMonth,
    monthly_overhead_cost: row.monthlyOverheadCost,
    planned_activity_overhead: row.plannedActivityOverhead,
    actual_activity_overhead: row.actualActivityOverhead,
    computed_at: new Date().toISOString(),
  }))

  const chunk = 500
  for (let i = 0; i < payload.length; i += chunk) {
    const { error } = await supabase.from('activity_month_allocations').insert(payload.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }

  for (const total of built.totals) {
    const { error } = await supabase
      .from('monthly_project_progress')
      .update({
        monthly_overhead_cost: total.monthlyOverheadCost,
        planned_overhead: total.plannedOverhead,
        actual_overhead: total.actualOverhead,
      })
      .eq('project_id', projectId)
      .eq('month', total.month)
    if (error) throw new Error(error.message)
  }

  return { months: months.length, activities: tasks.length }
}
