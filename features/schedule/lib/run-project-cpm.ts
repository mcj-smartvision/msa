import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRelationType } from '@/shared/types/schedule'
import {
calculateCpm,
type CpmActivityResult,
} from '@/features/schedule/lib/cpm-calculate'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'
import { diffDaysIso, toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
evaluateAndPersistFloatAlerts,
loadPreviousFloatByActivity,
} from '@/features/schedule/lib/run-float-alerts'
import type { ScheduleAlertDraft } from '@/features/schedule/lib/float-alerts'
import {
persistMilestoneForecasts,
resolveCpmCalendarEpoch,
} from '@/features/schedule/lib/milestone-forecast'
import { persistProjectProgressPace } from '@/features/schedule/lib/persist-progress-pace'

export interface ProjectCpmRunResult {
  projectId: string
  projectDurationDays: number
  calculatedAt: string
  calculationDate: string
  activities: CpmActivityResult[]
  criticalIds: string[]
  alerts: ScheduleAlertDraft[]
  saved: {
    scheduleCalculationsUpserted: number
    floatHistoryInserted: number
    alertsCreated: number
    milestoneBaselinesSet: number
    milestoneForecastsInserted: number
    progressPaceUpdated?: number
  }
}

function lagMinutesToDays(lagMinutes: number, minutesPerDay = DEFAULT_MSP_MINUTES_PER_DAY): number {
  if (!Number.isFinite(lagMinutes) || lagMinutes === 0) return 0
  const dayLen = minutesPerDay > 0 ? minutesPerDay : DEFAULT_MSP_MINUTES_PER_DAY
  return Math.round(lagMinutes / dayLen)
}

function resolveDurationDays(task: {
  duration_days?: number | null
  is_milestone?: boolean | null
  start_planned?: string | null
  finish_planned?: string | null
  start_current?: string | null
  finish_current?: string | null
}): number {
  if (task.is_milestone) return 0
  if (task.duration_days != null && Number.isFinite(Number(task.duration_days))) {
    return Math.max(0, Number(task.duration_days))
  }
  const start = toIsoDateOnly(task.start_planned ?? task.start_current)
  const finish = toIsoDateOnly(task.finish_planned ?? task.finish_current)
  if (start && finish) {
    return Math.max(0, diffDaysIso(start, finish))
  }
  return 0
}

/**
 * Load project_tasks + task_dependencies, run day-based CPM, persist latest + history.
 */
export async function runProjectCpmCalculation(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectCpmRunResult> {
  const [{ data: tasks, error: tasksError }, { data: deps, error: depsError }] = await Promise.all([
    supabase
      .from('project_tasks')
      .select(
        'id, name, duration_days, is_summary, is_milestone, start_planned, finish_planned, start_current, finish_current'
      )
      .eq('project_id', projectId),
    supabase
      .from('task_dependencies')
      .select(
        'predecessor_task_id, successor_task_id, relation_type, lag_duration, lag_days, lag_is_percentage'
      )
      .eq('project_id', projectId),
  ])

  if (tasksError) throw new Error(`خواندن فعالیت‌ها ناموفق: ${tasksError.message}`)
  if (depsError) throw new Error(`خواندن وابستگی‌ها ناموفق: ${depsError.message}`)

  const cpmInputActivities = (tasks ?? []).map((t) => ({
    id: t.id as string,
    durationDays: resolveDurationDays(t),
    isSummary: Boolean(t.is_summary),
  }))

  // Percent-lag links are stored for reporting but excluded from system CPM
  const cpmInputDeps = (deps ?? [])
    .filter((d) => !d.lag_is_percentage)
    .map((d) => {
      const lagDays =
        d.lag_days != null && Number.isFinite(Number(d.lag_days))
          ? Number(d.lag_days)
          : lagMinutesToDays(Number(d.lag_duration) || 0)
      return {
        predecessorId: d.predecessor_task_id as string,
        successorId: d.successor_task_id as string,
        type: d.relation_type as TaskRelationType,
        lagDays,
      }
    })

  const cpm = calculateCpm(cpmInputActivities, cpmInputDeps)
  if (cpm.success === false) {
    const err = new Error(cpm.message) as Error & {
      code?: string
      cycleIds?: string[]
    }
    err.code = cpm.error
    err.cycleIds = cpm.cycleIds
    throw err
  }

  const now = new Date()
  const calculatedAt = now.toISOString()
  const calculationDate = calculatedAt.slice(0, 10)

  const activityIds = cpm.activities.map((a) => a.id)
  const previousByActivityId = await loadPreviousFloatByActivity(supabase, projectId, activityIds)

  const calcRows = cpm.activities.map((a) => ({
    project_id: projectId,
    task_id: a.id,
    early_start: a.earlyStart,
    early_finish: a.earlyFinish,
    late_start: a.lateStart,
    late_finish: a.lateFinish,
    total_float: a.totalFloat,
    is_critical: a.isCritical,
    project_duration_days: cpm.projectDurationDays,
    calculated_at: calculatedAt,
  }))

  const historyRows = cpm.activities.map((a) => ({
    project_id: projectId,
    task_id: a.id,
    early_start: a.earlyStart,
    early_finish: a.earlyFinish,
    late_start: a.lateStart,
    late_finish: a.lateFinish,
    total_float: a.totalFloat,
    is_critical: a.isCritical,
    project_duration_days: cpm.projectDurationDays,
    calculation_date: calculationDate,
    calculated_at: calculatedAt,
  }))

  const { error: upsertError } = await supabase.from('schedule_calculations').upsert(calcRows, {
    onConflict: 'project_id,task_id',
  })
  if (upsertError) {
    throw new Error(`ذخیره schedule_calculations ناموفق: ${upsertError.message}`)
  }

  const { error: historyError } = await supabase.from('float_history').insert(historyRows)
  if (historyError) {
    throw new Error(`ذخیره float_history ناموفق: ${historyError.message}`)
  }

  // Cache float/critical on activities for UI tables (preview / send schedule)
  await Promise.all(
    cpm.activities.map((a) =>
      supabase
        .from('project_tasks')
        .update({
          total_float_days: a.totalFloat,
          is_critical: a.isCritical,
        })
        .eq('id', a.id)
        .eq('project_id', projectId)
    )
  )

  const taskNameById = new Map<string, string>()
  for (const t of tasks ?? []) {
    taskNameById.set(t.id as string, String(t.name ?? ''))
  }

  const { alertsCreated, drafts } = await evaluateAndPersistFloatAlerts(supabase, {
    projectId,
    calculationDate,
    activities: cpm.activities,
    taskNameById,
    previousByActivityId,
  })

  const milestoneTaskIds = new Set(
    (tasks ?? [])
      .filter((t) => Boolean(t.is_milestone) || resolveDurationDays(t) === 0)
      .filter((t) => !t.is_summary)
      .map((t) => t.id as string)
  )

  const cpmEpoch =
    (await resolveCpmCalendarEpoch(
      supabase,
      projectId,
      (tasks ?? []).map((t) => t.start_current ?? t.start_planned)
    )) ?? calculationDate

  const milestoneSaved = await persistMilestoneForecasts(supabase, {
    projectId,
    calculationDate,
    calculatedAt,
    cpmEpoch,
    activities: cpm.activities,
    milestoneTaskIds,
  })

  // Progress Pace (هشدار هوشمند پیشرفت — بخش 1)
  let paceUpdated = 0
  try {
    const pace = await persistProjectProgressPace(supabase, projectId, {
      statusDate: calculationDate,
    })
    paceUpdated = pace.updated
  } catch {
    // Optional columns may be missing until migration 77 is applied
    paceUpdated = 0
  }

  return {
    projectId,
    projectDurationDays: cpm.projectDurationDays,
    calculatedAt,
    calculationDate,
    activities: cpm.activities,
    criticalIds: cpm.criticalIds,
    alerts: drafts,
    saved: {
      scheduleCalculationsUpserted: calcRows.length,
      floatHistoryInserted: historyRows.length,
      alertsCreated,
      milestoneBaselinesSet: milestoneSaved.baselinesSet,
      milestoneForecastsInserted: milestoneSaved.forecastsInserted,
      progressPaceUpdated: paceUpdated,
    },
  }
}
