import { diffDaysIso, toIsoDateOnly } from '@/features/schedule/lib/dates'

export type PaceStatus = 'good' | 'warning' | 'bad'

export type PaceThresholds = {
  goodMin: number
  warningMin: number
}

export const DEFAULT_PACE_THRESHOLDS: PaceThresholds = {
  goodMin: 0.9,
  warningMin: 0.6,
}

export function paceThresholdsFromAlertSettings(settings: {
  paceGoodThreshold?: number
  paceWarningThreshold?: number
}): PaceThresholds {
  const goodMin =
    settings.paceGoodThreshold != null && Number.isFinite(settings.paceGoodThreshold)
      ? settings.paceGoodThreshold
      : DEFAULT_PACE_THRESHOLDS.goodMin
  const warningMin =
    settings.paceWarningThreshold != null && Number.isFinite(settings.paceWarningThreshold)
      ? settings.paceWarningThreshold
      : DEFAULT_PACE_THRESHOLDS.warningMin
  if (warningMin >= goodMin) {
    return { ...DEFAULT_PACE_THRESHOLDS }
  }
  return { goodMin, warningMin }
}

/**
 * Effective start for pace: recorded actual_start, else schedule start when
 * the activity already has physical progress (edited / catch-up schedule).
 * With allowZeroProgress, also use schedule start for 0% (سر‌تیتر شروع‌شده ولی بدون پیشرفت).
 */
export function resolvePaceActualStart(input: {
  actualStart?: string | null
  physicalPercentComplete?: number | null
  startCurrent?: string | null
  startPlanned?: string | null
  allowZeroProgress?: boolean
}): string | null {
  const recorded = toIsoDateOnly(input.actualStart)
  if (recorded) return recorded

  const physical = Number(input.physicalPercentComplete)
  if (!Number.isFinite(physical) || physical >= 100) return null
  if (physical <= 0 && !input.allowZeroProgress) return null

  // The approved plan, not the progress forecast kept in *_current.
  return toIsoDateOnly(input.startPlanned) ?? toIsoDateOnly(input.startCurrent)
}

export function resolvePaceDurationDays(input: {
  durationDays?: number | null
  startCurrent?: string | null
  startPlanned?: string | null
  finishCurrent?: string | null
  finishPlanned?: string | null
}): number | null {
  if (
    input.durationDays != null &&
    Number.isFinite(Number(input.durationDays)) &&
    Number(input.durationDays) > 0
  ) {
    return Number(input.durationDays)
  }
  const start = toIsoDateOnly(input.startPlanned ?? input.startCurrent)
  const finish = toIsoDateOnly(input.finishPlanned ?? input.finishCurrent)
  if (start && finish) {
    // Inclusive span so 1-day tasks still have duration > 0 for pace
    return Math.max(1, diffDaysIso(start, finish) || 1)
  }
  return null
}

export type ProgressPaceInput = {
  actualStart: string | null | undefined
  /** Prefer physical_percent_complete; fall back to percent_complete */
  physicalPercentComplete: number | null | undefined
  durationDays: number | null | undefined
  /** Data date / status date (ISO). Defaults handled by caller. */
  statusDate: string | null | undefined
  isSummary?: boolean | null
  isMilestone?: boolean | null
  /** When true, still compute pace for summary/header (mother) rows */
  includeSummary?: boolean
  paceThresholds?: PaceThresholds
}

export type ProgressPaceResult = {
  /** null when activity is not in-progress or pace cannot be judged */
  paceRatio: number | null
  paceStatus: PaceStatus | null
  expectedPercent: number | null
  elapsedDays: number | null
}

const EPS = 1e-9

/**
 * Progress Pace for in-progress activities:
 *   expected% = elapsedDays(actual_start → status_date) / duration_days × 100
 *   pace_ratio = physical% / expected%
 *
 * Classification (defaults; overridable via paceThresholds / project_alert_settings):
 *   >= goodMin → good
 *   >= warningMin → warning
 *   else → bad
 *
 * Not started / complete / summary / milestone / invalid duration → null.
 */
export function computeProgressPace(input: ProgressPaceInput): ProgressPaceResult {
  const empty: ProgressPaceResult = {
    paceRatio: null,
    paceStatus: null,
    expectedPercent: null,
    elapsedDays: null,
  }

  if (input.isSummary || input.isMilestone) {
    if (!input.includeSummary) return empty
    if (input.isMilestone) return empty
  }

  const actualStart = toIsoDateOnly(input.actualStart)
  if (!actualStart) return empty

  const physical = Number(input.physicalPercentComplete)
  if (!Number.isFinite(physical)) return empty
  if (physical >= 100) return empty

  const duration = Number(input.durationDays)
  if (!Number.isFinite(duration) || duration <= 0) return empty

  const statusDate = toIsoDateOnly(input.statusDate)
  if (!statusDate) return empty

  // Not yet started relative to status date
  if (statusDate < actualStart) return empty

  const elapsedDays = Math.max(0, diffDaysIso(actualStart, statusDate))
  const expectedPercent = (elapsedDays / duration) * 100

  // Same calendar day (or no elapsed time): cannot form a meaningful ratio yet
  if (expectedPercent <= EPS) {
    return {
      paceRatio: null,
      paceStatus: null,
      expectedPercent: 0,
      elapsedDays,
    }
  }

  const paceRatio = physical / expectedPercent
  const thresholds = input.paceThresholds ?? DEFAULT_PACE_THRESHOLDS
  const paceStatus = classifyPaceRatio(paceRatio, thresholds)

  return {
    paceRatio: Math.round(paceRatio * 10000) / 10000,
    paceStatus,
    expectedPercent: Math.round(expectedPercent * 100) / 100,
    elapsedDays,
  }
}

export function classifyPaceRatio(
  paceRatio: number,
  thresholds: PaceThresholds = DEFAULT_PACE_THRESHOLDS
): PaceStatus {
  if (paceRatio >= thresholds.goodMin) return 'good'
  if (paceRatio >= thresholds.warningMin) return 'warning'
  return 'bad'
}

export function paceStatusFa(status: PaceStatus | null | undefined): string {
  if (status === 'good') return 'خوب'
  if (status === 'warning') return 'هشدار'
  if (status === 'bad') return 'ضعیف'
  return '—'
}
