import type { SupabaseClient } from '@supabase/supabase-js'
import { enumerateProjectJalaliMonths, projectDateSpan } from '@/lib/schedule/monthly-deducted-weight'
import { plannedMonthlyWeights } from '@/lib/schedule/planned-month-weight'
import { toIsoDateOnly } from '@/lib/schedule/dates'

type TaskRow = {
  id: string
  project_id: string
  baseline_start: string | null
  baseline_finish: string | null
  start_current: string | null
  finish_current: string | null
  start_planned: string | null
  finish_planned: string | null
  physical_weight: number | null
  schedule_weight: number | null
  is_summary: boolean | null
}

type StoredRow = {
  activity_id: string
  baseline_start: string | null
  baseline_finish: string | null
  physical_weight: number | null
}

function isoDay(value: string | null | undefined): string | null {
  return toIsoDateOnly(value)
}

function weightOf(task: TaskRow): number {
  const raw = task.physical_weight ?? task.schedule_weight
  if (raw == null || !Number.isFinite(Number(raw))) return 0
  return Number(raw)
}

/** Same dates the schedule editor shows as شروع / پایان. */
function scheduleStart(task: TaskRow): string | null {
  return isoDay(task.start_current) ?? isoDay(task.start_planned) ?? isoDay(task.baseline_start)
}

function scheduleFinish(task: TaskRow): string | null {
  return isoDay(task.finish_current) ?? isoDay(task.finish_planned) ?? isoDay(task.baseline_finish)
}

function signature(start: string | null, finish: string | null, weight: number): string {
  return `${start ?? ''}|${finish ?? ''}|${weight}`
}

async function fetchTasks(
  supabase: SupabaseClient,
  projectId: string,
  activityId?: string
): Promise<TaskRow[]> {
  const pageSize = 500
  const rows: TaskRow[] = []
  let from = 0
  for (;;) {
    let query = supabase
      .from('project_tasks')
      .select(
        'id, project_id, baseline_start, baseline_finish, start_current, finish_current, start_planned, finish_planned, physical_weight, schedule_weight, is_summary'
      )
      .eq('project_id', projectId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (activityId) query = query.eq('id', activityId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as TaskRow[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function fetchStored(
  supabase: SupabaseClient,
  projectId: string,
  activityId?: string
): Promise<Map<string, StoredRow[]>> {
  const map = new Map<string, StoredRow[]>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    let query = supabase
      .from('activity_planned_weights')
      .select('activity_id, baseline_start, baseline_finish, physical_weight')
      .eq('project_id', projectId)
      .range(from, from + pageSize - 1)
    if (activityId) query = query.eq('activity_id', activityId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as StoredRow[]
    for (const row of batch) {
      const list = map.get(row.activity_id) ?? []
      list.push(row)
      map.set(row.activity_id, list)
    }
    if (batch.length < pageSize) break
    from += pageSize
  }
  return map
}

async function rebuildProjectTotals(supabase: SupabaseClient, projectId: string) {
  const { data: tasks, error: taskError } = await supabase
    .from('project_tasks')
    .select('id, is_summary')
    .eq('project_id', projectId)
  if (taskError) throw new Error(taskError.message)
  const leafIds = new Set(
    ((tasks ?? []) as Array<{ id: string; is_summary: boolean | null }>)
      .filter((task) => !task.is_summary)
      .map((task) => task.id)
  )

  const { data, error } = await supabase
    .from('activity_planned_weights')
    .select('activity_id, snapshot_month, jalali_month, planned_weight')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)

  const totals = new Map<string, { jalaliMonth: string; planned: number }>()
  for (const row of data ?? []) {
    if (!leafIds.has(row.activity_id as string)) continue
    const key = String(row.snapshot_month).slice(0, 10)
    const current = totals.get(key) ?? {
      jalaliMonth: String(row.jalali_month),
      planned: 0,
    }
    current.planned += Number(row.planned_weight) || 0
    totals.set(key, current)
  }

  const { error: deleteError } = await supabase
    .from('project_planned_weights')
    .delete()
    .eq('project_id', projectId)
  if (deleteError) throw new Error(deleteError.message)

  const payload = [...totals.entries()].map(([snapshotMonth, value]) => ({
    project_id: projectId,
    snapshot_month: snapshotMonth,
    jalali_month: value.jalaliMonth,
    planned_weight: Math.round(value.planned * 10000) / 10000,
    computed_at: new Date().toISOString(),
  }))
  if (payload.length === 0) return
  const { error: insertError } = await supabase.from('project_planned_weights').insert(payload)
  if (insertError) throw new Error(insertError.message)
}

/**
 * Store planned monthly weights. Skips an activity when its baseline dates
 * and physical weight still match the stored signature.
 */
export async function persistPlannedWeights(
  supabase: SupabaseClient,
  projectId: string,
  activityId?: string
): Promise<{ updatedActivities: number; skippedActivities: number }> {
  const tasks = await fetchTasks(supabase, projectId, activityId)
  const stored = await fetchStored(supabase, projectId, activityId)

  const span = projectDateSpan(
    tasks.map((task) => ({
      startDate: scheduleStart(task),
      finishDate: scheduleFinish(task),
    }))
  )
  const months = enumerateProjectJalaliMonths(span.start, span.finish)

  let updatedActivities = 0
  let skippedActivities = 0

  for (const task of tasks) {
    const start = scheduleStart(task)
    const finish = scheduleFinish(task)
    const weight = weightOf(task)
    const existing = stored.get(task.id) ?? []
    const storedSig =
      existing.length > 0
        ? signature(
            isoDay(existing[0]?.baseline_start),
            isoDay(existing[0]?.baseline_finish),
            Number(existing[0]?.physical_weight) || 0
          )
        : null
    const nextSig = signature(start, finish, weight)
    if (storedSig === nextSig) {
      skippedActivities += 1
      continue
    }
    if ((!start || !finish || weight === 0) && existing.length === 0) {
      skippedActivities += 1
      continue
    }

    const { error: deleteError } = await supabase
      .from('activity_planned_weights')
      .delete()
      .eq('activity_id', task.id)
    if (deleteError) throw new Error(deleteError.message)

    const slices = plannedMonthlyWeights(weight, start, finish, months)
    if (slices.length > 0) {
      const { error: insertError } = await supabase.from('activity_planned_weights').insert(
        slices.map((slice) => ({
          project_id: projectId,
          activity_id: task.id,
          snapshot_month: slice.snapshotMonth,
          jalali_month: slice.jalaliMonth,
          planned_weight: slice.plannedWeight,
          overlap_days: slice.overlapDays,
          baseline_start: start,
          baseline_finish: finish,
          physical_weight: weight,
          computed_at: new Date().toISOString(),
        }))
      )
      if (insertError) throw new Error(insertError.message)
    }
    updatedActivities += 1
  }

  if (updatedActivities > 0) {
    await rebuildProjectTotals(supabase, projectId)
  }

  try {
    const { persistMonthlyProjectProgress } = await import(
      '@/lib/schedule/persist-monthly-project-progress'
    )
    await persistMonthlyProjectProgress(supabase, projectId)
  } catch {
    /* monthly_project_progress optional until migration 96 */
  }

  return { updatedActivities, skippedActivities }
}
