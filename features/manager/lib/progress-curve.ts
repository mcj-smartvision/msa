import { toGregorian, toJalaali } from 'jalaali-js'
import { progressWeightOf, resolveProgressBasis, weightedPercents } from '@/features/evm/lib/metrics'
import type { ProjectEvmActivityRow } from '@/features/evm/lib/load-project-evm'
import { DAYS_PER_UNIT, solveEarnedSchedule } from '@/features/project-controls/lib/earned-schedule'
import { buildBaselinePVCurve } from '@/features/project-controls/lib/pv-curve'
import type { EvForecast } from '@/features/project-controls/lib/ev-forecast'
import type { ManagerCurve, ManagerCurvePoint, ManagerScheduleForecast } from '@/features/manager/lib/overview-types'

const DAY_MS = 86_400_000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoOf(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS)
}

function jalaliMonthStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const { jy, jm } = toJalaali(y, m, d)
  const g = toGregorian(jy, jm, 1)
  return isoOf(g.gy, g.gm, g.gd)
}

function jalaliMonthEnd(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const { jy, jm } = toJalaali(y, m, d)
  const next = jm === 12 ? toGregorian(jy + 1, 1, 1) : toGregorian(jy, jm + 1, 1)
  return addDays(isoOf(next.gy, next.gm, next.gd), -1)
}

function projectSpan(activities: ProjectEvmActivityRow[]): { start: string; finish: string } | null {
  let start: string | null = null
  let finish: string | null = null
  for (const a of activities) {
    const s = a.baselineStart?.slice(0, 10) ?? null
    const f = (a.baselineFinish ?? a.baselineStart)?.slice(0, 10) ?? null
    if (s && (!start || s < start)) start = s
    if (f && (!finish || f > finish)) finish = f
  }
  return start && finish ? { start, finish } : null
}

/** Σ wᵢ·plannedᵢ ÷ Σ wᵢ at a date — identical to the planned percent behind the SPI card. */
export function plannedPercentAt(activities: ProjectEvmActivityRow[], asOf: string): number {
  return weightedPercents(activities, asOf).plannedPercent
}

/** Weight-based approved physical progress; null when the schedule carries no weights. */
export function actualPercentOf(
  activities: ProjectEvmActivityRow[],
  percentOf: (a: ProjectEvmActivityRow) => number
): number | null {
  let weight = 0
  let done = 0
  for (const a of activities) {
    if (!(a.weight > 0)) continue
    weight += a.weight
    done += a.weight * percentOf(a)
  }
  return weight > 0 ? done / weight : null
}

/**
 * Earned Schedule in calendar days on the weight-basis baseline curve (the same engine as the
 * background page): AT = today − start, ES from the curve, variance = AT − ES (positive = behind).
 * Two finish forecasts: optimistic = baseline finish + variance (remaining work at plan speed,
 * never before today while work remains); trend = today + (PD − ES) ÷ SPI(t).
 */
export function scheduleForecast(
  activities: ProjectEvmActivityRow[],
  earnedPercent: number,
  today: string
): ManagerScheduleForecast | null {
  const basis = resolveProgressBasis(activities)
  const curve = buildBaselinePVCurve(
    activities.map((a) => ({
      weight: progressWeightOf(a, basis),
      baselineStart: a.baselineStart,
      baselineFinish: a.baselineFinish,
    })),
    DAYS_PER_UNIT.days,
    { scaleTo: 100 }
  )
  if (!curve) return null
  const pd = curve.plannedDurationPeriods
  const at = dayDiff(today, curve.projectStartDate)
  const { es } = solveEarnedSchedule(curve.points, earnedPercent, pd)
  const varianceDays = Math.round(at - es)
  const spiT = at > 0 ? es / at : null
  const done = earnedPercent >= 99.95
  let forecastFinish = addDays(curve.baselineFinishDate, varianceDays)
  if (!done && forecastFinish < today) forecastFinish = today
  const trendFinish = done ? today : spiT != null && spiT > 0 ? addDays(today, Math.round((pd - es) / spiT)) : null
  return {
    start: curve.projectStartDate,
    plannedFinish: curve.baselineFinishDate,
    forecastFinish,
    trendFinish,
    varianceDays,
    actualTimeDays: at,
    earnedScheduleDays: es,
    plannedDurationDays: pd,
    spiT,
    planPeriodEnded: today > curve.baselineFinishDate,
  }
}

export interface ProgressSnapshotRow {
  activityId: string
  snapshotMonth: string
  cumulativePercent: number
}

/** One recorded progress report of a task or package (`task_progress_updates` / `package_progress_updates`). */
export interface ProgressRecordRow {
  activityId: string
  /** Report date the progress belongs to (YYYY-MM-DD). */
  date: string
  /** Entry time, orders several records of the same day. */
  at: string
  percent: number
}

/**
 * S-curve on Jalali month ends plus every day with recorded progress. The today point equals the
 * KPI cards (weighted planned, earned and actual percent). Actual and EV are drawn only from the first
 * recorded progress on: an activity keeps its first recorded value before that record and its
 * current value when it has no record at all, so no gain is invented.
 */
export function buildProgressCurve(input: {
  activities: ProjectEvmActivityRow[]
  budgetBasis: ManagerCurve['budgetBasis']
  earnedPercent: number
  actualPercent: number | null
  today: string
  snapshots: ProgressSnapshotRow[]
  records?: ProgressRecordRow[]
  /** Explainable-engine EV forecast, sampled on the given Jalali month ends (see `buildEvForecast`). */
  forecast?: (dates: string[]) => EvForecast
}): ManagerCurve | null {
  const { today } = input
  const basis = resolveProgressBasis(input.activities)
  const activities = input.activities.filter((a) => progressWeightOf(a, basis) > 0)
  const totalWeight = activities.reduce((s, a) => s + progressWeightOf(a, basis), 0)
  const span = projectSpan(activities)
  if (!span || totalWeight <= 0) return null

  const snapshotsOf = new Map<string, ProgressSnapshotRow[]>()
  for (const row of input.snapshots) {
    const list = snapshotsOf.get(row.activityId) ?? []
    list.push(row)
    snapshotsOf.set(row.activityId, list)
  }
  for (const list of snapshotsOf.values()) list.sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth))

  const ids = new Set(activities.map((a) => a.id))
  const recordsOf = new Map<string, ProgressRecordRow[]>()
  for (const row of input.records ?? []) {
    if (!ids.has(row.activityId) || row.date > today) continue
    const list = recordsOf.get(row.activityId) ?? []
    list.push(row)
    recordsOf.set(row.activityId, list)
  }
  for (const list of recordsOf.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))

  const useSnapshots = snapshotsOf.size > 0
  const useRecords = !useSnapshots && recordsOf.size > 0
  let historyStart: string | null = null
  if (useRecords) {
    for (const list of recordsOf.values()) if (!historyStart || list[0].date < historyStart) historyStart = list[0].date
  }

  const percentAt = (a: ProjectEvmActivityRow, date: string): number => {
    if (useSnapshots) {
      const monthStart = jalaliMonthStart(date)
      let value = 0
      for (const row of snapshotsOf.get(a.id) ?? []) {
        if (row.snapshotMonth > monthStart) break
        value = row.cumulativePercent
      }
      return value
    }
    const list = recordsOf.get(a.id)
    if (!list) return a.physicalPercent
    let value = list[0].percent
    for (const row of list) {
      if (row.date > date) break
      value = row.percent
    }
    return value
  }

  const valuesAt = (date: string): { earned: number | null; actual: number | null } => {
    if (date > today) return { earned: null, actual: null }
    if (date === today) return { earned: input.earnedPercent, actual: input.actualPercent }
    if (useRecords && historyStart && date < historyStart) return { earned: null, actual: null }
    if (!useSnapshots && !useRecords) return { earned: null, actual: null }
    let earned = 0
    for (const a of activities) earned += progressWeightOf(a, basis) * percentAt(a, date)
    return { earned: earned / totalWeight, actual: actualPercentOf(activities, (a) => percentAt(a, date)) }
  }

  const dates = new Map<string, ManagerCurvePoint['kind']>()
  const last = span.finish > today ? span.finish : today
  let cursor = jalaliMonthStart(span.start)
  let guard = 0
  while (cursor <= last && guard < 240) {
    guard += 1
    const end = jalaliMonthEnd(cursor)
    if (end !== today) dates.set(end, 'month')
    cursor = addDays(end, 1)
  }
  for (const list of recordsOf.values()) {
    for (const row of list) if (row.date < today && !dates.has(row.date)) dates.set(row.date, 'record')
  }
  dates.set(today, 'today')

  let forecast: EvForecast = input.forecast
    ? input.forecast(monthEndsFrom(today, 240))
    : { status: 'unavailable', reason_fa: 'شاخص‌های Earned Schedule برای پیش‌بینی در دسترس نیست' }
  if (forecast.status === 'ok' && forecast.asOf !== today) {
    forecast = { status: 'unavailable', reason_fa: `تاریخ وضعیت شاخص‌ها (${forecast.asOf}) با امروز (${today}) یکی نیست` }
  }
  const forecastAt = new Map<string, number>()
  if (forecast.status === 'ok') {
    for (const point of forecast.points) {
      forecastAt.set(point.date, point.earned)
      if (!dates.has(point.date)) dates.set(point.date, point.date === forecast.finishDate ? 'forecast' : 'month')
    }
  }

  const points: ManagerCurvePoint[] = [...dates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kind]) => ({
      date,
      isToday: kind === 'today',
      kind,
      planned: plannedPercentAt(activities, date),
      ...valuesAt(date),
      forecast: forecastAt.get(date) ?? null,
    }))

  return { points, hasHistory: useSnapshots || useRecords, historyStart, budgetBasis: input.budgetBasis, forecast }
}

/** Jalali month ends after `iso`, `count` of them. */
function monthEndsFrom(iso: string, count: number): string[] {
  const out: string[] = []
  let cursor = jalaliMonthStart(iso)
  for (let i = 0; i < count; i++) {
    const end = jalaliMonthEnd(cursor)
    if (end > iso) out.push(end)
    cursor = addDays(end, 1)
  }
  return out
}
