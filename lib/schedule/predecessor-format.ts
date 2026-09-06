import type { TaskRelationType } from '@/types/schedule'

/** MSP lag_duration is stored in minutes (LinkLag tenths ÷ 10). */
export const DEFAULT_MSP_MINUTES_PER_DAY = 480

/**
 * Format lag minutes as compact day offset for predecessor labels.
 * Examples: 960 → "+2d", -2160 → "-5d" (nearest working day at 480 min/day)
 */
export function formatLagDaysSuffix(
  lagMinutes: number,
  minutesPerDay: number = DEFAULT_MSP_MINUTES_PER_DAY
): string {
  if (!Number.isFinite(lagMinutes) || lagMinutes === 0) return ''
  const dayLen = minutesPerDay > 0 ? minutesPerDay : DEFAULT_MSP_MINUTES_PER_DAY
  const days = Math.round(lagMinutes / dayLen)
  if (days === 0) return ''
  const sign = days > 0 ? '+' : ''
  return `${sign}${days}d`
}

export function formatPredLabel(
  wbs: string,
  relation: TaskRelationType,
  lagMinutes: number,
  minutesPerDay: number = DEFAULT_MSP_MINUTES_PER_DAY
): string {
  return `${wbs}${relation}${formatLagDaysSuffix(lagMinutes, minutesPerDay)}`
}

/** Parse "1.2FS, 3.1SS+2d" style labels into predecessor WBS codes. */
export function parsePredecessorWbsCodes(label: string | null | undefined): string[] {
  if (!label?.trim()) return []
  const codes: string[] = []
  const seen = new Set<string>()
  for (const match of label.matchAll(/(\d+(?:\.\d+)*)(?:FS|SS|FF|SF)/gi)) {
    const wbs = match[1]
    if (!wbs || seen.has(wbs)) continue
    seen.add(wbs)
    codes.push(wbs)
  }
  return codes
}
