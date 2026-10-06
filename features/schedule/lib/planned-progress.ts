import { toTehranDateOnly } from '@/shared/lib/time/tehran'

/**
 * Planned progress — the single implementation of "how much of an activity's window should be
 * done by a date". Every planned value (PV, S-curve, daily plan, period comparison, plan
 * compliance, supervisor plan, monthly planned weights) goes through this module.
 *
 * Conventions:
 * - Dates are civil YYYY-MM-DD on Tehran's calendar; timestamps are reduced in Tehran time.
 * - Both ends of the window count: day 1 of a 10-day window is 10 %, the finish day is 100 %.
 * - Before the start → 0; on or after the finish → 100; a missing finish means a one-day window.
 * - No rounding here: callers round only for display.
 * - Days are counted by a `WorkCalendar`: calendar days today, a working-day calendar later.
 */
export interface WorkCalendar {
  id: string
  /** Countable days in [startIso, endIso], both ends inclusive; 0 when end < start. */
  countDays(startIso: string, endIso: string): number
}

const DAY_MS = 86_400_000

function utcDay(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d)
}

export const CALENDAR_DAYS: WorkCalendar = {
  id: 'calendar-days',
  countDays(startIso, endIso) {
    const a = utcDay(startIso)
    const b = utcDay(endIso)
    if (a == null || b == null || b < a) return 0
    return Math.round((b - a) / DAY_MS) + 1
  },
}

export interface PlannedWindow {
  start: string | null | undefined
  finish: string | null | undefined
}

/** Normalized window, or null when it has no start. A missing finish is the start day. */
export function normalizeWindow(window: PlannedWindow): { start: string; finish: string } | null {
  const start = toTehranDateOnly(window.start ?? null)
  const finish = toTehranDateOnly(window.finish ?? null) ?? start
  return start && finish ? { start, finish } : null
}

/** Planned percent (0–100) of a window as of a date. */
export function plannedPercentInWindow(
  window: PlannedWindow,
  asOfIso: string,
  calendar: WorkCalendar = CALENDAR_DAYS
): number {
  const w = normalizeWindow(window)
  const asOf = toTehranDateOnly(asOfIso)
  if (!w || !asOf) return 0
  if (asOf < w.start) return 0
  if (asOf >= w.finish) return 100
  const total = calendar.countDays(w.start, w.finish)
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, (calendar.countDays(w.start, asOf) / total) * 100))
}

/** Σ(weight × planned %) ÷ Σ(weight) over rows with a positive weight; null when none. */
export function weightedPlannedPercent(
  rows: Array<PlannedWindow & { weight: number }>,
  asOfIso: string,
  calendar: WorkCalendar = CALENDAR_DAYS
): number | null {
  let total = 0
  let done = 0
  for (const row of rows) {
    if (!(row.weight > 0)) continue
    total += row.weight
    done += row.weight * plannedPercentInWindow(row, asOfIso, calendar)
  }
  return total > 0 ? done / total : null
}
