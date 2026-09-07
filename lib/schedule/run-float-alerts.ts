import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PROJECT_ALERT_SETTINGS,
  buildScheduleAlertDrafts,
  type ProjectAlertSettings,
  type PreviousFloatSample,
  type ScheduleAlertDraft,
} from '@/lib/schedule/float-alerts'
import type { CpmActivityResult } from '@/lib/schedule/cpm-calculate'

function alertDayBounds(isoDate: string): { start: string; end: string } {
  return {
    start: `${isoDate}T00:00:00.000Z`,
    end: `${isoDate}T23:59:59.999Z`,
  }
}

export async function loadProjectAlertSettings(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectAlertSettings> {
  const { data, error } = await supabase
    .from('project_alert_settings')
    .select('near_critical_days, fast_consumption_threshold')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    throw new Error(`خواندن project_alert_settings ناموفق: ${error.message}`)
  }

  if (!data) {
    const { error: insertError } = await supabase.from('project_alert_settings').insert({
      project_id: projectId,
      near_critical_days: DEFAULT_PROJECT_ALERT_SETTINGS.nearCriticalDays,
      fast_consumption_threshold: DEFAULT_PROJECT_ALERT_SETTINGS.fastConsumptionThreshold,
    })
    // Race / unique: ignore if another request created it
    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      throw new Error(`ایجاد project_alert_settings ناموفق: ${insertError.message}`)
    }
    return { ...DEFAULT_PROJECT_ALERT_SETTINGS }
  }

  return {
    nearCriticalDays: Number(data.near_critical_days) || DEFAULT_PROJECT_ALERT_SETTINGS.nearCriticalDays,
    fastConsumptionThreshold:
      Number(data.fast_consumption_threshold) ||
      DEFAULT_PROJECT_ALERT_SETTINGS.fastConsumptionThreshold,
  }
}

/**
 * Latest float_history row per task (before current insert) = previous sample.
 */
export async function loadPreviousFloatByActivity(
  supabase: SupabaseClient,
  projectId: string,
  activityIds: string[]
): Promise<Map<string, PreviousFloatSample>> {
  const map = new Map<string, PreviousFloatSample>()
  if (activityIds.length === 0) return map

  const { data, error } = await supabase
    .from('float_history')
    .select('task_id, total_float, calculation_date, calculated_at')
    .eq('project_id', projectId)
    .in('task_id', activityIds)
    .order('calculated_at', { ascending: false })

  if (error) {
    throw new Error(`خواندن float_history ناموفق: ${error.message}`)
  }

  for (const row of data ?? []) {
    const id = row.task_id as string
    if (map.has(id)) continue
    map.set(id, {
      totalFloat: Number(row.total_float) || 0,
      calculationDate: String(row.calculation_date).slice(0, 10),
    })
  }
  return map
}

export async function loadExistingUnackedAlertKeysToday(
  supabase: SupabaseClient,
  projectId: string,
  currentDate: string
): Promise<Set<string>> {
  const { start, end } = alertDayBounds(currentDate)
  const { data, error } = await supabase
    .from('schedule_alerts')
    .select('activity_id, severity')
    .eq('project_id', projectId)
    .eq('acknowledged', false)
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) {
    throw new Error(`خواندن schedule_alerts ناموفق: ${error.message}`)
  }

  const keys = new Set<string>()
  for (const row of data ?? []) {
    keys.add(`${row.activity_id}:${row.severity}`)
  }
  return keys
}

export async function persistScheduleAlerts(
  supabase: SupabaseClient,
  projectId: string,
  drafts: ScheduleAlertDraft[]
): Promise<number> {
  if (drafts.length === 0) return 0
  const rows = drafts.map((d) => ({
    project_id: projectId,
    activity_id: d.activityId,
    severity: d.severity,
    message: d.message,
    total_float: d.totalFloat,
    consumption_rate: d.consumptionRate,
    acknowledged: false,
  }))
  const { error } = await supabase.from('schedule_alerts').insert(rows)
  if (error) {
    throw new Error(`ذخیره schedule_alerts ناموفق: ${error.message}`)
  }
  return rows.length
}

export async function evaluateAndPersistFloatAlerts(
  supabase: SupabaseClient,
  input: {
    projectId: string
    calculationDate: string
    activities: CpmActivityResult[]
    taskNameById: Map<string, string>
    /** Previous float samples captured BEFORE inserting today's history. */
    previousByActivityId: Map<string, PreviousFloatSample>
  }
): Promise<{ alertsCreated: number; drafts: ScheduleAlertDraft[] }> {
  const settings = await loadProjectAlertSettings(supabase, input.projectId)
  const existingUnackedKeys = await loadExistingUnackedAlertKeysToday(
    supabase,
    input.projectId,
    input.calculationDate
  )

  const drafts = buildScheduleAlertDrafts({
    activities: input.activities.map((a) => ({
      id: a.id,
      name: input.taskNameById.get(a.id) ?? null,
      totalFloat: a.totalFloat,
    })),
    previousByActivityId: input.previousByActivityId,
    currentDate: input.calculationDate,
    settings,
    existingUnackedKeys,
  })

  const alertsCreated = await persistScheduleAlerts(supabase, input.projectId, drafts)
  return { alertsCreated, drafts }
}
