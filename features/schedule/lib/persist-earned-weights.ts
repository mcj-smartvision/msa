import type { SupabaseClient } from '@supabase/supabase-js'
import { earnedMonthlyWeights } from '@/features/schedule/lib/earned-month-weight'

type TaskRow = {
  id: string
  physical_weight: number | null
  schedule_weight: number | null
  is_summary: boolean | null
}

type SnapshotRow = {
  activity_id: string
  snapshot_month: string
  jalali_month: string
  cumulative_percent: number
}

function weightOf(task: TaskRow): number {
  const raw = task.physical_weight ?? task.schedule_weight
  if (raw == null || !Number.isFinite(Number(raw))) return 0
  return Number(raw)
}

/**
 * Rebuild earned monthly weights from progress_snapshots.
 * Runs whenever snapshots or activity weight change. Baseline dates are not used.
 */
export async function persistEarnedWeights(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ activities: number; months: number }> {
  const { data: taskData, error: taskError } = await supabase
    .from('project_tasks')
    .select('id, physical_weight, schedule_weight, is_summary')
    .eq('project_id', projectId)
  if (taskError) throw new Error(taskError.message)
  const tasks = (taskData ?? []) as TaskRow[]
  const taskById = new Map(tasks.map((task) => [task.id, task]))

  const snapshots: SnapshotRow[] = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('progress_snapshots')
      .select('activity_id, snapshot_month, jalali_month, cumulative_percent')
      .eq('project_id', projectId)
      .order('snapshot_month', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as SnapshotRow[]
    snapshots.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  const byActivity = new Map<string, SnapshotRow[]>()
  for (const row of snapshots) {
    const list = byActivity.get(row.activity_id) ?? []
    list.push(row)
    byActivity.set(row.activity_id, list)
  }

  const { error: deleteError } = await supabase
    .from('activity_earned_weights')
    .delete()
    .eq('project_id', projectId)
  if (deleteError) throw new Error(deleteError.message)

  const payload = []
  for (const [activityId, rows] of byActivity) {
    const task = taskById.get(activityId)
    if (!task) continue
    const weight = weightOf(task)
    const slices = earnedMonthlyWeights(
      weight,
      rows.map((row) => ({
        snapshotMonth: String(row.snapshot_month).slice(0, 10),
        jalaliMonth: row.jalali_month,
        cumulativePercent: Number(row.cumulative_percent) || 0,
      }))
    )
    for (const slice of slices) {
      payload.push({
        project_id: projectId,
        activity_id: activityId,
        snapshot_month: slice.snapshotMonth,
        jalali_month: slice.jalaliMonth,
        percent_this_month: slice.percentThisMonth,
        percent_previous_month: slice.percentPreviousMonth,
        earned_weight: slice.earnedWeight,
        physical_weight: weight,
        computed_at: new Date().toISOString(),
      })
    }
  }

  const chunk = 500
  for (let i = 0; i < payload.length; i += chunk) {
    const { error } = await supabase.from('activity_earned_weights').insert(payload.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }

  const leafIds = new Set(tasks.filter((task) => !task.is_summary).map((task) => task.id))
  const totals = new Map<string, { jalaliMonth: string; earned: number }>()
  for (const row of payload) {
    if (!leafIds.has(row.activity_id)) continue
    const current = totals.get(row.snapshot_month) ?? { jalaliMonth: row.jalali_month, earned: 0 }
    current.earned += row.earned_weight
    totals.set(row.snapshot_month, current)
  }

  const { error: deleteTotalsError } = await supabase
    .from('project_earned_weights')
    .delete()
    .eq('project_id', projectId)
  if (deleteTotalsError) throw new Error(deleteTotalsError.message)

  const totalRows = [...totals.entries()].map(([snapshotMonth, value]) => ({
    project_id: projectId,
    snapshot_month: snapshotMonth,
    jalali_month: value.jalaliMonth,
    earned_weight: Math.round(value.earned * 10000) / 10000,
    computed_at: new Date().toISOString(),
  }))
  if (totalRows.length > 0) {
    const { error } = await supabase.from('project_earned_weights').insert(totalRows)
    if (error) throw new Error(error.message)
  }

  try {
    const { persistMonthlyProjectProgress } = await import(
      '@/features/schedule/lib/persist-monthly-project-progress'
    )
    await persistMonthlyProjectProgress(supabase, projectId)
  } catch {
    /* monthly_project_progress optional until migration 96 */
  }

  return { activities: byActivity.size, months: payload.length }
}
