import type { SupabaseClient } from '@supabase/supabase-js';
import {
DEFAULT_PROJECT_ALERT_SETTINGS,
buildScheduleAlertDrafts,
type ProjectAlertSettings,
type PreviousFloatSample,
type ScheduleAlertDraft,
} from '@/features/schedule/lib/float-alerts';
import type { CpmActivityResult } from '@/features/schedule/lib/cpm-calculate';

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
  let data: Record<string, unknown> | null = null
  const full = await supabase
    .from('project_alert_settings')
    .select(
      'near_critical_days, fast_consumption_threshold, pace_good_threshold, pace_warning_threshold'
    )
    .eq('project_id', projectId)
    .maybeSingle()

  if (full.error && /pace_good|pace_warning|does not exist|42703/i.test(full.error.message)) {
    const basic = await supabase
      .from('project_alert_settings')
      .select('near_critical_days, fast_consumption_threshold')
      .eq('project_id', projectId)
      .maybeSingle()
    if (basic.error) {
      throw new Error(`خواندن project_alert_settings ناموفق: ${basic.error.message}`)
    }
    data = (basic.data as Record<string, unknown> | null) ?? null
  } else if (full.error) {
    throw new Error(`خواندن project_alert_settings ناموفق: ${full.error.message}`)
  } else {
    data = (full.data as Record<string, unknown> | null) ?? null
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

  return normalizeProjectAlertSettings({
    near_critical_days: data.near_critical_days,
    fast_consumption_threshold: data.fast_consumption_threshold,
    pace_good_threshold: data.pace_good_threshold,
    pace_warning_threshold: data.pace_warning_threshold,
  })
}

function normalizeProjectAlertSettings(row: {
  near_critical_days?: unknown
  fast_consumption_threshold?: unknown
  pace_good_threshold?: unknown
  pace_warning_threshold?: unknown
}): ProjectAlertSettings {
  const nearCriticalDays =
    Number(row.near_critical_days) || DEFAULT_PROJECT_ALERT_SETTINGS.nearCriticalDays
  const fastConsumptionThreshold =
    Number(row.fast_consumption_threshold) ||
    DEFAULT_PROJECT_ALERT_SETTINGS.fastConsumptionThreshold
  let paceGoodThreshold =
    Number(row.pace_good_threshold) || DEFAULT_PROJECT_ALERT_SETTINGS.paceGoodThreshold
  let paceWarningThreshold =
    Number(row.pace_warning_threshold) || DEFAULT_PROJECT_ALERT_SETTINGS.paceWarningThreshold
  if (
    !Number.isFinite(paceGoodThreshold) ||
    paceGoodThreshold <= 0 ||
    paceGoodThreshold > 1
  ) {
    paceGoodThreshold = DEFAULT_PROJECT_ALERT_SETTINGS.paceGoodThreshold
  }
  if (
    !Number.isFinite(paceWarningThreshold) ||
    paceWarningThreshold <= 0 ||
    paceWarningThreshold > 1 ||
    paceWarningThreshold >= paceGoodThreshold
  ) {
    paceWarningThreshold = DEFAULT_PROJECT_ALERT_SETTINGS.paceWarningThreshold
  }
  return {
    nearCriticalDays,
    fastConsumptionThreshold,
    paceGoodThreshold,
    paceWarningThreshold,
  }
}

export type ProjectAlertSettingsPatch = Partial<
  Pick<
    ProjectAlertSettings,
    | 'nearCriticalDays'
    | 'fastConsumptionThreshold'
    | 'paceGoodThreshold'
    | 'paceWarningThreshold'
  >
>

export function validateProjectAlertSettingsPatch(
  patch: ProjectAlertSettingsPatch
): string | null {
  const g = patch.paceGoodThreshold
  const w = patch.paceWarningThreshold
  const n = patch.nearCriticalDays
  const f = patch.fastConsumptionThreshold
  if (g != null && (g <= 0 || g > 1)) return 'آستانه «خوب» باید بین ۰ و ۱ باشد'
  if (w != null && (w <= 0 || w > 1)) return 'آستانه «هشدار» باید بین ۰ و ۱ باشد'
  if (g != null && w != null && w >= g) {
    return 'آستانه هشدار باید کمتر از آستانه خوب باشد'
  }
  if (n != null && (n < 0 || !Number.isFinite(n))) {
    return 'روزهای نزدیک‌بحرانی نامعتبر است'
  }
  if (f != null && (f <= 0 || !Number.isFinite(f))) {
    return 'آستانه مصرف سریع نامعتبر است'
  }
  return null
}

export async function saveProjectAlertSettings(
  supabase: SupabaseClient,
  projectId: string,
  patch: ProjectAlertSettingsPatch
): Promise<ProjectAlertSettings> {
  const err = validateProjectAlertSettingsPatch(patch)
  if (err) throw new Error(err)

  const current = await loadProjectAlertSettings(supabase, projectId)
  const merged: ProjectAlertSettings = {
    nearCriticalDays: patch.nearCriticalDays ?? current.nearCriticalDays,
    fastConsumptionThreshold:
      patch.fastConsumptionThreshold ?? current.fastConsumptionThreshold,
    paceGoodThreshold: patch.paceGoodThreshold ?? current.paceGoodThreshold,
    paceWarningThreshold: patch.paceWarningThreshold ?? current.paceWarningThreshold,
  }
  const mergedErr = validateProjectAlertSettingsPatch(merged)
  if (mergedErr) throw new Error(mergedErr)

  const { error } = await supabase
    .from('project_alert_settings')
    .update({
      near_critical_days: merged.nearCriticalDays,
      fast_consumption_threshold: merged.fastConsumptionThreshold,
      pace_good_threshold: merged.paceGoodThreshold,
      pace_warning_threshold: merged.paceWarningThreshold,
      updated_at: new Date().toISOString(),
    })
    .eq('project_id', projectId)

  if (error) throw new Error(`ذخیره project_alert_settings ناموفق: ${error.message}`)
  return merged
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
