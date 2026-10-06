import type { PVCurvePoint } from '@/shared/types/project-controls'
import { CALENDAR_DAYS, plannedPercentInWindow, type WorkCalendar } from '@/features/schedule/lib/planned-progress'
import { toTehranDateOnly } from '@/shared/lib/time/tehran'

const DAY_MS = 86_400_000

export interface BaselineActivity {
  /** What the curve accumulates: a schedule weight (progress basis) or a budget. */
  weight: number
  baselineStart: string | null
  baselineFinish: string | null
}

export interface BaselinePVCurve {
  projectStartDate: string
  baselineFinishDate: string
  plannedDurationPeriods: number
  points: PVCurvePoint[]
  /** Activities left out because they have no baseline start. */
  skipped: number
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Cumulative baseline PV per period. Time is measured in elapsed days from the start of the project
 * start date, so the value at t = d covers the baseline plan through the day before start + d
 * (both window ends count, as in `plannedPercentInWindow`). The last point is (PD, BAC) and
 * PD = (baseline finish − start + 1) ÷ daysPerUnit. With `scaleTo`, values are rescaled so the
 * curve ends at that total (e.g. 100 for a percent-of-project curve).
 */
export function buildBaselinePVCurve(
  activities: BaselineActivity[],
  daysPerUnit: number,
  options: { calendar?: WorkCalendar; scaleTo?: number } = {}
): BaselinePVCurve | null {
  const calendar = options.calendar ?? CALENDAR_DAYS
  const rows = activities
    .map((a) => ({
      weight: Number(a.weight) || 0,
      start: toTehranDateOnly(a.baselineStart),
      finish: toTehranDateOnly(a.baselineFinish) ?? toTehranDateOnly(a.baselineStart),
    }))
    .filter((a) => a.weight > 0)
  const datedRaw = rows.filter((a): a is { weight: number; start: string; finish: string } => Boolean(a.start && a.finish))
  if (datedRaw.length === 0 || !(daysPerUnit > 0)) return null
  const rawTotal = datedRaw.reduce((s, a) => s + a.weight, 0)
  const factor = options.scaleTo != null && rawTotal > 0 ? options.scaleTo / rawTotal : 1
  const dated = datedRaw.map((a) => ({ ...a, weight: a.weight * factor }))

  const start = dated.reduce((m, a) => (a.start < m ? a.start : m), dated[0]!.start)
  const finish = dated.reduce((m, a) => (a.finish > m ? a.finish : m), dated[0]!.finish)
  const totalDays = Math.round((Date.parse(`${finish}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1

  const daily: number[] = [0]
  for (let d = 1; d <= totalDays; d++) {
    const asOf = addDays(start, d - 1)
    daily.push(dated.reduce((s, a) => s + (a.weight * plannedPercentInWindow(a, asOf, calendar)) / 100, 0))
  }
  const pvAt = (t: number) => {
    const d = Math.min(totalDays, Math.max(0, Math.floor(t)))
    const frac = Math.min(1, Math.max(0, t - d))
    const a = daily[d]!
    const b = daily[Math.min(totalDays, d + 1)]!
    return a + (b - a) * frac
  }

  const pd = totalDays / daysPerUnit
  const points: PVCurvePoint[] = []
  for (let k = 0; k < pd; k++) {
    const t = k * daysPerUnit
    points.push({ periodIndex: k, cumulativePV: pvAt(t), date: addDays(start, Math.floor(t)) })
  }
  points.push({ periodIndex: pd, cumulativePV: daily[totalDays]!, date: addDays(finish, 1) })

  return {
    projectStartDate: start,
    baselineFinishDate: finish,
    plannedDurationPeriods: pd,
    points,
    skipped: rows.length - dated.length,
  }
}
