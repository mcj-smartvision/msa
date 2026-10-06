import { toGregorian, toJalaali } from 'jalaali-js'

/** Iran has kept a fixed UTC+03:30 offset (no daylight saving) since 2022. */
export const TEHRAN_OFFSET_MS = 3.5 * 3_600_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export interface TehranParts {
  gy: number
  gm: number
  gd: number
  /** 0 = Saturday … 6 = Friday. */
  weekday: number
  msOfDay: number
}

export function tehranParts(ms: number): TehranParts {
  const d = new Date(ms + TEHRAN_OFFSET_MS)
  return {
    gy: d.getUTCFullYear(),
    gm: d.getUTCMonth() + 1,
    gd: d.getUTCDate(),
    weekday: (d.getUTCDay() + 1) % 7,
    msOfDay: d.getUTCHours() * HOUR_MS + d.getUTCMinutes() * 60_000 + d.getUTCSeconds() * 1000 + d.getUTCMilliseconds(),
  }
}

/** The instant Tehran's calendar day gy-gm-gd begins. */
export function tehranMidnight(gy: number, gm: number, gd: number): number {
  return Date.UTC(gy, gm - 1, gd) - TEHRAN_OFFSET_MS
}

/** Tehran calendar date (YYYY-MM-DD) of an instant. */
export function tehranDateIso(ms: number): string {
  const p = tehranParts(ms)
  return `${p.gy}-${String(p.gm).padStart(2, '0')}-${String(p.gd).padStart(2, '0')}`
}

/**
 * Civil YYYY-MM-DD of a stored date or timestamp, read on Tehran's calendar. A pure date is
 * trusted as-is; a timestamp is reduced in Tehran time, whatever the host time zone.
 */
export function toTehranDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const ms = Date.parse(trimmed)
  return Number.isNaN(ms) ? null : tehranDateIso(ms)
}

/** Today's Tehran calendar date, independent of the server or browser time zone. */
export function todayTehranIso(nowMs: number = Date.now()): string {
  return tehranDateIso(nowMs)
}

export type TehranPeriod = 'today' | 'week' | 'month'

/** Start of today, of the Iranian week (Saturday) or of the current Jalali month, in Tehran time. */
export function tehranPeriodStartMs(period: TehranPeriod, nowMs: number = Date.now()): number {
  const p = tehranParts(nowMs)
  const todayStart = tehranMidnight(p.gy, p.gm, p.gd)
  if (period === 'week') return todayStart - p.weekday * DAY_MS
  if (period === 'month') {
    const { jy, jm } = toJalaali(p.gy, p.gm, p.gd)
    const g = toGregorian(jy, jm, 1)
    return tehranMidnight(g.gy, g.gm, g.gd)
  }
  return todayStart
}
