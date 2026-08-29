import type { ScheduleAnalysisConfig } from '@/types/schedule-intelligence'

/** Parse ISO date/time to UTC date parts (avoid local TZ off-by-one in comparisons). */
export function parseIsoToUtcMs(value: string | null | undefined): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.getTime()
}

export function isoOrNull(value: unknown): string | null {
  if (value == null) return null
  const v = String(value).trim()
  if (!v || v === 'NA') return null
  const ms = parseIsoToUtcMs(v)
  return ms == null ? null : new Date(ms).toISOString()
}

export function utcDateOnlyMs(value: string, policy: ScheduleAnalysisConfig['timezonePolicy']): number {
  const d = new Date(value)
  if (policy === 'local-date') {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function calendarDaysBetween(
  fromDate: string,
  toDate: string,
  policy: ScheduleAnalysisConfig['timezonePolicy']
): number {
  const a = utcDateOnlyMs(fromDate, policy)
  const b = utcDateOnlyMs(toDate, policy)
  return Math.round((b - a) / 86400000)
}

export function workingDaysBetween(
  fromDate: string,
  toDate: string,
  config: ScheduleAnalysisConfig
): number {
  const start = utcDateOnlyMs(fromDate, config.timezonePolicy)
  const end = utcDateOnlyMs(toDate, config.timezonePolicy)
  if (end < start) return -workingDaysBetween(toDate, fromDate, config)
  let count = 0
  for (let t = start; t < end; t += 86400000) {
    const day = new Date(t).getUTCDay()
    if (!config.weekendDays.includes(day)) count++
  }
  return count
}

export function minutesToDisplayDays(minutes: number, minutesPerDay: number): number {
  if (minutesPerDay <= 0) return 0
  return Math.round((minutes / minutesPerDay) * 100) / 100
}

export function formatMinutesAsDays(minutes: number | null, minutesPerDay: number): string {
  if (minutes == null) return '—'
  const days = minutesToDisplayDays(minutes, minutesPerDay)
  return `${days.toLocaleString('fa-IR')} روز`
}

export function formatPercentFa(value: number): string {
  return `${Math.round(value).toLocaleString('fa-IR')}%`
}
