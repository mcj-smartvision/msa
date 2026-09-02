import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canSnapshotPlannedAsBaseline,
  ScheduleRebuildError,
  snapshotPlannedAsBaseline,
} from '@/lib/schedule/baseline-template'
import {
  computeBaselineStartFromTasks,
  diffDaysIso,
  toIsoDateOnly,
} from '@/lib/schedule/dates'
import { shiftScheduleByActualStart } from '@/lib/schedule/reschedule-engine'
import { normalizeScheduleWeightPercent, weightedProgressPercent } from '@/lib/schedule/weighted-progress'
import type { ProjectTask } from '@/types/schedule'

export interface ApplyActualStartInput {
  projectId: string
  actualStartDate: string
  alignedWithBaseline: boolean
}

export interface ScheduleStartAnalysis {
  baseline_start: string
  actual_start: string
  shift_days: number
  /** Flat calendar-day offset applied to every baseline date. */
  delta_days: number
  tasks_updated: number
  tasks_in_progress: number
  tasks_completed: number
  tasks_delayed: number
  overall_percent: number
  rebuilt_from_dependencies: boolean
  anchor_wbs?: string | null
  baseline_backfilled?: number
}

export interface ApplyActualStartResult {
  analysis: ScheduleStartAnalysis
  tasks: ProjectTask[]
  actual_start: string
}

export async function fetchProjectScheduleMeta(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  schedule_baseline_start: string | null
  schedule_actual_start: string | null
  schedule_start_aligned: boolean | null
}> {
  const { data, error } = await supabase
    .from('projects')
    .select('schedule_baseline_start, schedule_actual_start, schedule_start_aligned')
    .eq('id', projectId)
    .maybeSingle()

  if (error) {
    if (error.code === '42703') {
      return { schedule_baseline_start: null, schedule_actual_start: null, schedule_start_aligned: null }
    }
    throw new Error(error.message)
  }

  return {
    schedule_baseline_start: data?.schedule_baseline_start ?? null,
    schedule_actual_start: data?.schedule_actual_start ?? null,
    schedule_start_aligned: data?.schedule_start_aligned ?? null,
  }
}

/**
 * Ensure every task has immutable baseline_start/baseline_finish before rebuild.
 * Snapshots planned dates only when the project has never been rescheduled.
 */
async function ensureImmutableBaselines(
  supabase: SupabaseClient,
  tasks: ProjectTask[],
  hasPriorReschedule: boolean
): Promise<{ tasks: ProjectTask[]; backfilled: number }> {
  let backfilled = 0
  const updatedTasks = tasks.map((task) => ({ ...task }))
  const missingBaseline = updatedTasks.filter(
    (t) => !toIsoDateOnly(t.baseline_start) || !toIsoDateOnly(t.baseline_finish)
  )

  if (missingBaseline.length === 0) {
    return { tasks: updatedTasks, backfilled: 0 }
  }

  if (hasPriorReschedule) {
    const names = missingBaseline.slice(0, 3).map((t) => t.name).join(', ')
    throw new ScheduleRebuildError(
      `${missingBaseline.length} task(s) lack immutable baseline dates (${names}${missingBaseline.length > 3 ? '…' : ''}). Re-import the MSP XML schedule to repair baselines.`
    )
  }

  for (let i = 0; i < updatedTasks.length; i++) {
    const task = updatedTasks[i]
    if (toIsoDateOnly(task.baseline_start) && toIsoDateOnly(task.baseline_finish)) continue

    if (!canSnapshotPlannedAsBaseline(task)) {
      throw new ScheduleRebuildError(
        `Task "${task.name}" has no baseline or planned dates. Re-import the MSP XML schedule.`
      )
    }

    const snapshot = snapshotPlannedAsBaseline(task)
    const { error } = await supabase
      .from('project_tasks')
      .update({
        baseline_start: snapshot.baseline_start,
        baseline_finish: snapshot.baseline_finish,
      })
      .eq('id', task.id)

    if (error) {
      if (error.code === '42703') {
        throw new ScheduleRebuildError(
          'Database is missing baseline_start/baseline_finish columns. Run migration 27-schedule-baseline-dates.sql in Supabase.'
        )
      }
      throw new Error(error.message)
    }

    updatedTasks[i] = { ...task, ...snapshot }
    backfilled++
  }

  return { tasks: updatedTasks, backfilled }
}

export async function applyActualStartToSchedule(
  supabase: SupabaseClient,
  input: ApplyActualStartInput
): Promise<ApplyActualStartResult> {
  const { projectId, actualStartDate, alignedWithBaseline } = input

  const [{ data: tasks, error: tasksError }, { data: projectRow }] = await Promise.all([
      supabase.from('project_tasks').select('*').eq('project_id', projectId),
      supabase
        .from('projects')
        .select('schedule_baseline_start, schedule_actual_start')
        .eq('id', projectId)
        .maybeSingle(),
    ])

  if (tasksError) throw new Error(tasksError.message)

  let rows = (tasks ?? []) as ProjectTask[]

  if (rows.length === 0) {
    throw new Error('No tasks found — import MSP XML first')
  }

  const hasPriorReschedule = Boolean(toIsoDateOnly(projectRow?.schedule_actual_start))
  const { tasks: baselinedTasks, backfilled } = await ensureImmutableBaselines(
    supabase,
    rows,
    hasPriorReschedule
  )
  rows = baselinedTasks

  const baselineStart =
    toIsoDateOnly(projectRow?.schedule_baseline_start) ??
    computeBaselineStartFromTasks(rows) ??
    toIsoDateOnly(rows[0].baseline_start) ??
    actualStartDate

  const actualStart = alignedWithBaseline ? baselineStart : toIsoDateOnly(actualStartDate) ?? actualStartDate

  const shifted = shiftScheduleByActualStart(actualStart, rows, baselineStart)
  const shiftDays = shifted.deltaDays

  const today = new Date().toISOString().slice(0, 10)
  let tasksInProgress = 0
  let tasksCompleted = 0
  let tasksDelayed = 0
  let tasksUpdated = 0

  const progressRows: Array<{ progress: number; weight: number }> = []

  for (const task of rows) {
    const pct = Number(task.percent_complete)
    if (!task.is_summary) {
      progressRows.push({
        progress: pct,
        weight: normalizeScheduleWeightPercent(task.schedule_weight),
      })
    }

    const dates = shifted.taskDates.get(task.id)
    if (!dates) {
      throw new ScheduleRebuildError(`Rebuild did not produce dates for task "${task.name}".`)
    }

    const { error: updateError } = await supabase
      .from('project_tasks')
      .update({
        start_planned: dates.start,
        finish_planned: dates.finish,
        start_current: dates.start,
        finish_current: dates.finish,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    if (updateError) throw new Error(updateError.message)
    tasksUpdated++

    if (pct >= 100) tasksCompleted++
    else if (pct > 0) tasksInProgress++

    const finishIso = toIsoDateOnly(dates.finish)
    if (pct < 100 && finishIso && finishIso < today) tasksDelayed++
  }

  const projectUpdate: Record<string, unknown> = {
    schedule_baseline_start: baselineStart,
    schedule_actual_start: actualStart,
    schedule_start_aligned: alignedWithBaseline,
    start_date: actualStart,
  }

  const { error: projectError } = await supabase
    .from('projects')
    .update(projectUpdate)
    .eq('id', projectId)

  if (projectError && projectError.code !== '42703') {
    throw new Error(projectError.message)
  }

  const { data: updatedTasks, error: refetchError } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('start_planned', { ascending: true })

  if (refetchError) throw new Error(refetchError.message)

  const analysis: ScheduleStartAnalysis = {
    baseline_start: baselineStart,
    actual_start: actualStart,
    shift_days: shiftDays,
    delta_days: shiftDays,
    tasks_updated: tasksUpdated,
    tasks_in_progress: tasksInProgress,
    tasks_completed: tasksCompleted,
    tasks_delayed: tasksDelayed,
    overall_percent: weightedProgressPercent(progressRows),
    rebuilt_from_dependencies: false,
    anchor_wbs: shifted.anchorWbs,
    baseline_backfilled: backfilled > 0 ? backfilled : undefined,
  }

  return {
    analysis,
    tasks: (updatedTasks ?? []) as ProjectTask[],
    actual_start: actualStart,
  }
}

/** After MSP import: store baseline, keep current = planned until user confirms actual start. */
export async function setScheduleBaselineAfterImport(
  supabase: SupabaseClient,
  projectId: string,
  baselineStart: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    schedule_baseline_start: baselineStart,
    schedule_actual_start: null,
    schedule_start_aligned: null,
  }

  const { error } = await supabase.from('projects').update(payload).eq('id', projectId)
  if (error && error.code !== '42703') throw new Error(error.message)
}

export { ScheduleRebuildError }
