import { toGregorian, toJalaali } from 'jalaali-js'
import { plannedPercentAsOf } from '@/lib/evm/metrics'
import type { ProjectEvmActivityRow } from '@/lib/evm/load-project-evm'
import type { ManagerCurve, ManagerCurvePoint } from '@/lib/manager/overview-types'

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

/** PV ÷ BAC at a date — identical to the EVM metric used by the cards. */
export function plannedPercentAt(activities: ProjectEvmActivityRow[], bac: number, asOf: string): number {
  if (bac <= 0) return 0
  let pv = 0
  for (const a of activities) pv += a.budget * (plannedPercentAsOf(a.baselineStart, a.baselineFinish, asOf) / 100)
  return (pv / bac) * 100
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
 * Earned-schedule variance in days: how far today is from the date the plan reached today's
 * earned progress. Positive means behind plan.
 */
export function scheduleVarianceDays(
  activities: ProjectEvmActivityRow[],
  bac: number,
  earnedPercent: number,
  today: string
): number | null {
  const span = projectSpan(activities)
  if (!span || bac <= 0) return null
  let lo = 0
  let hi = Math.max(0, dayDiff(span.finish, span.start))
  if (plannedPercentAt(activities, bac, span.finish) < earnedPercent - 0.01) return null
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (plannedPercentAt(activities, bac, addDays(span.start, mid)) >= earnedPercent - 0.01) hi = mid
    else lo = mid + 1
  }
  return dayDiff(today, addDays(span.start, lo))
}

export interface ProgressSnapshotRow {
  activityId: string
  snapshotMonth: string
  cumulativePercent: number
}

/**
 * Monthly S-curve on Jalali month ends. The point for the current month is today itself, so the
 * last plotted values equal the KPI cards (PV/BAC, EV/BAC and weighted actual).
 */
export function buildProgressCurve(input: {
  activities: ProjectEvmActivityRow[]
  bac: number
  budgetBasis: ManagerCurve['budgetBasis']
  earnedPercent: number
  actualPercent: number | null
  today: string
  snapshots: ProgressSnapshotRow[]
}): ManagerCurve | null {
  const { activities, bac, today } = input
  const span = projectSpan(activities)
  if (!span || bac <= 0) return null

  const byActivity = new Map<string, ProgressSnapshotRow[]>()
  for (const row of input.snapshots) {
    const list = byActivity.get(row.activityId) ?? []
    list.push(row)
    byActivity.set(row.activityId, list)
  }
  for (const list of byActivity.values()) list.sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth))
  const hasHistory = byActivity.size > 0

  const percentAtMonth = (a: ProjectEvmActivityRow, monthStart: string): number => {
    const list = byActivity.get(a.id)
    if (!list) return 0
    let value = 0
    for (const row of list) {
      if (row.snapshotMonth > monthStart) break
      value = row.cumulativePercent
    }
    return value
  }

  const todayMonth = jalaliMonthStart(today)
  const last = span.finish > today ? span.finish : today
  const points: ManagerCurvePoint[] = []
  let cursor = jalaliMonthStart(span.start)
  let guard = 0
  while (cursor <= last && guard < 240) {
    guard += 1
    const isCurrent = cursor === todayMonth
    const date = isCurrent ? today : jalaliMonthEnd(cursor)
    const past = date < today
    let earned: number | null = null
    let actual: number | null = null
    if (isCurrent) {
      earned = input.earnedPercent
      actual = input.actualPercent
    } else if (past && hasHistory) {
      let ev = 0
      for (const a of activities) ev += a.budget * (percentAtMonth(a, cursor) / 100)
      earned = (ev / bac) * 100
      actual = actualPercentOf(activities, (a) => percentAtMonth(a, cursor))
    }
    points.push({
      date,
      isToday: isCurrent,
      planned: plannedPercentAt(activities, bac, date),
      earned,
      actual,
    })
    cursor = addDays(jalaliMonthEnd(cursor), 1)
  }

  return { points, hasHistory, budgetBasis: input.budgetBasis }
}
