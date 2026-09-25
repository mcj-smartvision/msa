import { diffDaysIso } from '@/lib/schedule/dates'

export type ScheduleAlertSeverity =
  | 'negative'
  | 'critical'
  | 'near_critical'
  | 'fast_consumption'
  /** بحرانی/نزدیک‌بحرانی + نرخ پیشروی ضعیف (هشدار هوشمند پیشرفت) */
  | 'urgent'

export interface ProjectAlertSettings {
  nearCriticalDays: number
  /** Float-days consumed per calendar week (default 3). */
  fastConsumptionThreshold: number
  paceGoodThreshold: number
  paceWarningThreshold: number
}

export const DEFAULT_PROJECT_ALERT_SETTINGS: ProjectAlertSettings = {
  nearCriticalDays: 5,
  fastConsumptionThreshold: 3,
  paceGoodThreshold: 0.9,
  paceWarningThreshold: 0.6,
}

export interface FloatAlertActivity {
  id: string
  name?: string | null
  totalFloat: number
}

export interface PreviousFloatSample {
  totalFloat: number
  calculationDate: string
}

export interface ScheduleAlertDraft {
  activityId: string
  severity: ScheduleAlertSeverity
  message: string
  totalFloat: number
  consumptionRate: number | null
}

/**
 * Weekly float consumption from two history samples.
 * consumption_rate (per day) = (prevFloat - currentFloat) / daysBetween
 * Compared threshold is "days per week" → weekly = rate * 7.
 */
export function computeFloatConsumptionRate(
  previousFloat: number,
  currentFloat: number,
  previousDate: string,
  currentDate: string
): { ratePerDay: number; weeklyRate: number; daysBetween: number } | null {
  const daysBetween = diffDaysIso(previousDate, currentDate)
  if (daysBetween <= 0) return null
  const ratePerDay = (previousFloat - currentFloat) / daysBetween
  return {
    ratePerDay,
    weeklyRate: ratePerDay * 7,
    daysBetween,
  }
}

function activityLabel(a: FloatAlertActivity): string {
  const name = a.name?.trim()
  return name ? `«${name}»` : a.id
}

/**
 * Build alert drafts for one CPM run. Dedup keys are `${activityId}:${severity}` for today.
 */
export function buildScheduleAlertDrafts(input: {
  activities: FloatAlertActivity[]
  previousByActivityId: Map<string, PreviousFloatSample>
  currentDate: string
  settings?: Partial<ProjectAlertSettings>
  /** Existing unacknowledged alerts for this project on currentDate (same severity). */
  existingUnackedKeys: Set<string>
}): ScheduleAlertDraft[] {
  const settings: ProjectAlertSettings = {
    ...DEFAULT_PROJECT_ALERT_SETTINGS,
    ...input.settings,
  }
  const drafts: ScheduleAlertDraft[] = []

  for (const activity of input.activities) {
    const tf = activity.totalFloat
    const label = activityLabel(activity)

    const floatSeverities: Array<{
      severity: ScheduleAlertSeverity
      when: boolean
      message: string
    }> = [
      {
        severity: 'negative',
        when: tf < 0,
        message: `شناوری منفی برای ${label}: ${tf} روز — برنامه از مسیر بحرانی عقب‌تر است`,
      },
      {
        severity: 'critical',
        when: tf === 0,
        message: `مسیر بحرانی: ${label} شناوری صفر دارد`,
      },
      {
        severity: 'near_critical',
        when: tf > 0 && tf <= settings.nearCriticalDays,
        message: `نزدیک به بحرانی: ${label} فقط ${tf} روز شناوری دارد (آستانه ${settings.nearCriticalDays})`,
      },
    ]

    for (const rule of floatSeverities) {
      if (!rule.when) continue
      const key = `${activity.id}:${rule.severity}`
      if (input.existingUnackedKeys.has(key)) continue
      drafts.push({
        activityId: activity.id,
        severity: rule.severity,
        message: rule.message,
        totalFloat: tf,
        consumptionRate: null,
      })
      input.existingUnackedKeys.add(key)
    }

    const prev = input.previousByActivityId.get(activity.id)
    if (!prev) continue

    const consumption = computeFloatConsumptionRate(
      prev.totalFloat,
      tf,
      prev.calculationDate,
      input.currentDate
    )
    if (!consumption) continue
    if (consumption.weeklyRate <= settings.fastConsumptionThreshold) continue

    const key = `${activity.id}:fast_consumption`
    if (input.existingUnackedKeys.has(key)) continue

    drafts.push({
      activityId: activity.id,
      severity: 'fast_consumption',
      message: `مصرف سریع شناوری برای ${label}: حدود ${consumption.weeklyRate.toFixed(1)} روز در هفته (آستانه ${settings.fastConsumptionThreshold})`,
      totalFloat: tf,
      consumptionRate: consumption.ratePerDay,
    })
    input.existingUnackedKeys.add(key)
  }

  return drafts
}
