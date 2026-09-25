import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeProgressPace,
  paceThresholdsFromAlertSettings,
  resolvePaceActualStart,
  resolvePaceDurationDays,
} from '@/lib/schedule/progress-pace'
import { DEFAULT_PROJECT_ALERT_SETTINGS } from '@/lib/schedule/float-alerts'
import { computeAlertQuadrant, type AlertQuadrant } from '@/lib/schedule/progress-alert-quadrant'
import {
  loadExistingUnackedAlertKeysToday,
  loadProjectAlertSettings,
  persistScheduleAlerts,
} from '@/lib/schedule/run-float-alerts'
import type { ScheduleAlertDraft } from '@/lib/schedule/float-alerts'
import { notifyUrgentProgressAlerts } from '@/lib/schedule/notify-urgent-progress-alerts'
import { toIsoDateOnly } from '@/lib/schedule/dates'

export type ProgressPaceTaskRow = {
  id: string
  name?: string | null
  wbs_code?: string | null
  actual_start?: string | null
  physical_percent_complete?: number | null
  percent_complete?: number | null
  duration_days?: number | null
  status_date?: string | null
  is_summary?: boolean | null
  is_milestone?: boolean | null
  is_critical?: boolean | null
  total_float_days?: number | null
  start_planned?: string | null
  finish_planned?: string | null
  start_current?: string | null
  finish_current?: string | null
}

function buildUrgentMessage(
  name: string,
  wbs: string | null,
  paceRatio: number | null,
  totalFloat: number | null
): string {
  const label = wbs ? `${wbs} ${name}` : name
  const ratio = paceRatio != null ? paceRatio.toFixed(2) : '—'
  const tf = totalFloat != null ? `${totalFloat}` : '—'
  return `فعالیت بحرانی/نزدیک‌بحرانی با نرخ پیشروی ضعیف: ${label} (نرخ=${ratio}، شناوری=${tf} روز)`
}

/**
 * Recompute pace_ratio, pace_status, alert_quadrant; persist urgent → schedule_alerts + notify.
 */
export async function persistProjectProgressPace(
  supabase: SupabaseClient,
  projectId: string,
  options?: { statusDate?: string | null; tasks?: ProgressPaceTaskRow[] }
): Promise<{
  updated: number
  inProgress: number
  urgentAlertsCreated: number
  notificationsSent: number
}> {
  let tasks = options?.tasks
  if (!tasks) {
    const [{ data, error }, { data: calcs }] = await Promise.all([
      supabase
        .from('project_tasks')
        .select(
          'id, name, wbs_code, actual_start, physical_percent_complete, percent_complete, duration_days, status_date, is_summary, is_milestone, is_critical, total_float_days, start_planned, finish_planned, start_current, finish_current'
        )
        .eq('project_id', projectId),
      supabase
        .from('schedule_calculations')
        .select('task_id, total_float, is_critical')
        .eq('project_id', projectId),
    ])
    if (error) throw new Error(error.message)
    const calcByTask = new Map(
      (calcs ?? []).map((c) => [
        c.task_id as string,
        { totalFloat: Number(c.total_float), isCritical: Boolean(c.is_critical) },
      ])
    )
    tasks = ((data ?? []) as ProgressPaceTaskRow[]).map((t) => {
      const calc = calcByTask.get(t.id)
      return {
        ...t,
        is_critical: calc?.isCritical ?? t.is_critical,
        total_float_days:
          calc?.totalFloat != null && Number.isFinite(calc.totalFloat)
            ? calc.totalFloat
            : t.total_float_days,
      }
    })
  }

  const fallbackStatus =
    toIsoDateOnly(options?.statusDate) ?? new Date().toISOString().slice(0, 10)

  let settings = { ...DEFAULT_PROJECT_ALERT_SETTINGS }
  try {
    settings = await loadProjectAlertSettings(supabase, projectId)
  } catch {
    // project_alert_settings optional
  }
  const paceThresholds = paceThresholdsFromAlertSettings(settings)

  let existingKeys = new Set<string>()
  try {
    existingKeys = await loadExistingUnackedAlertKeysToday(
      supabase,
      projectId,
      fallbackStatus
    )
  } catch {
    existingKeys = new Set()
  }

  let updated = 0
  let inProgress = 0
  const urgentDrafts: ScheduleAlertDraft[] = []
  const notifyPayload: Array<{ activityId: string; activityName: string; message: string }> =
    []

  const chunkSize = 40
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (task) => {
        const physical =
          task.physical_percent_complete != null &&
          Number.isFinite(Number(task.physical_percent_complete))
            ? Number(task.physical_percent_complete)
            : Number(task.percent_complete) || 0

        const totalFloat =
          task.total_float_days != null && Number.isFinite(Number(task.total_float_days))
            ? Number(task.total_float_days)
            : null

        const effectiveStart = resolvePaceActualStart({
          actualStart: task.actual_start,
          physicalPercentComplete: physical,
          startCurrent: task.start_current,
          startPlanned: task.start_planned,
        })

        const result = computeProgressPace({
          actualStart: effectiveStart,
          physicalPercentComplete: physical,
          durationDays: resolvePaceDurationDays({
            durationDays: task.duration_days,
            startCurrent: task.start_current,
            startPlanned: task.start_planned,
            finishCurrent: task.finish_current,
            finishPlanned: task.finish_planned,
          }),
          statusDate: toIsoDateOnly(task.status_date) ?? fallbackStatus,
          isSummary: task.is_summary,
          isMilestone: task.is_milestone,
          paceThresholds,
        })

        const alertQuadrant: AlertQuadrant | null = computeAlertQuadrant({
          paceStatus: result.paceStatus,
          isCritical: task.is_critical,
          totalFloatDays: totalFloat,
          nearCriticalDays: settings.nearCriticalDays,
        })

        if (result.paceStatus != null) inProgress += 1

        if (alertQuadrant === 'urgent') {
          const key = `${task.id}:urgent`
          const name = String(task.name ?? 'فعالیت')
          const message = buildUrgentMessage(
            name,
            task.wbs_code?.trim() || null,
            result.paceRatio,
            totalFloat
          )
          if (!existingKeys.has(key)) {
            urgentDrafts.push({
              activityId: task.id,
              severity: 'urgent',
              message,
              totalFloat: totalFloat ?? 0,
              consumptionRate: result.paceRatio,
            })
            notifyPayload.push({ activityId: task.id, activityName: name, message })
          }
        }

        // Optional persist — works only after migrations 77/78
        const { error } = await supabase
          .from('project_tasks')
          .update({
            pace_ratio: result.paceRatio,
            pace_status: result.paceStatus,
            alert_quadrant: alertQuadrant,
          })
          .eq('id', task.id)
          .eq('project_id', projectId)

        if (!error) updated += 1
        // Ignore missing-column errors (schema not migrated yet)
      })
    )
  }

  let urgentAlertsCreated = 0
  let notificationsSent = 0
  try {
    urgentAlertsCreated = await persistScheduleAlerts(supabase, projectId, urgentDrafts)
    if (urgentAlertsCreated > 0) {
      notificationsSent = await notifyUrgentProgressAlerts(
        supabase,
        projectId,
        notifyPayload
      )
    }
  } catch {
    urgentAlertsCreated = 0
    notificationsSent = 0
  }

  return { updated, inProgress, urgentAlertsCreated, notificationsSent }
}
