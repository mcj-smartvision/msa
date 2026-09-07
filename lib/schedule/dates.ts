import { toJalaali, toGregorian } from 'jalaali-js'
import type { ScheduleCalendar } from '@/lib/schedule/calendar-preference'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseIsoDate(value: string): Date | null {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Format ISO timestamp for schedule display (Gregorian or Jalali only — never mixed). */
export function formatScheduleDate(
  value: string | null | undefined,
  calendar: ScheduleCalendar = 'jalali'
): string {
  const iso = toIsoDateOnly(value)
  if (!iso) return '—'

  const [gy, gm, gd] = iso.split('-').map(Number)
  if (!gy || !gm || !gd) return '—'

  if (calendar === 'jalali') {
    const { jy, jm, jd } = toJalaali(gy, gm, gd)
    return `${jy}/${pad2(jm)}/${pad2(jd)}`
  }

  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

/** Value for calendar-aware text/date inputs (matches active calendar mode). */
export function isoToCalendarInput(
  iso: string | null | undefined,
  calendar: ScheduleCalendar
): string {
  const isoDate = toIsoDateOnly(iso)
  if (!isoDate) return ''

  if (calendar === 'gregorian') return isoDate

  const [gy, gm, gd] = isoDate.split('-').map(Number)
  const { jy, jm, jd } = toJalaali(gy, gm, gd)
  return `${jy}/${pad2(jm)}/${pad2(jd)}`
}

/** Parse user input in the active calendar mode → normalized YYYY-MM-DD (Gregorian). */
export function parseScheduleDateInput(
  input: string,
  calendar: ScheduleCalendar
): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (calendar === 'gregorian') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
    const d = new Date(`${trimmed}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : trimmed
  }

  const normalized = trimmed.replace(/-/g, '/')
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const jy = Number(match[1])
  const jm = Number(match[2])
  const jd = Number(match[3])
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null

  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  const iso = `${gy}-${pad2(gm)}-${pad2(gd)}`
  const d = new Date(`${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : iso
}

export function formatScheduleDateTime(
  value: string | null | undefined,
  calendar: ScheduleCalendar = 'jalali'
): string {
  if (!value) return '—'
  const datePart = formatScheduleDate(value, calendar)
  const d = parseIsoDate(value)
  if (!d) return datePart
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${time}`
}

/**
 * Civil YYYY-MM-DD for schedule dates.
 * - Pure `YYYY-MM-DD` is trusted as-is.
 * - Timestamps use the **local** calendar day (not the UTC prefix), so MSP
 *   midnights stored as e.g. `…T20:30:00.000Z` in Iran stay on the intended day.
 */
export function toIsoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const d = parseIsoDate(trimmed)
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add calendar days to an ISO date string (YYYY-MM-DD). */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Difference in whole days: end - start. */
export function diffDaysIso(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T12:00:00`).getTime()
  const end = new Date(`${endIso}T12:00:00`).getTime()
  return Math.round((end - start) / (24 * 60 * 60 * 1000))
}

export function shiftIsoTimestamp(iso: string | null, dayOffset: number): string | null {
  if (!iso) return null
  const d = parseIsoDate(iso)
  if (!d) return null
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString()
}

/** Earliest YYYY-MM-DD from immutable baseline starts (falls back to planned only for legacy rows). */
export function computeBaselineStartFromTasks(
  tasks: Array<{ baseline_start?: string | null; start_planned?: string | null }>
): string | null {
  let min: string | null = null
  for (const task of tasks) {
    const iso = toIsoDateOnly(task.baseline_start) ?? toIsoDateOnly(task.start_planned ?? null)
    if (!iso) continue
    if (!min || iso < min) min = iso
  }
  return min
}
