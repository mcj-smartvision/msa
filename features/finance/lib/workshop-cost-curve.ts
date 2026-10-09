import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { allocateOverhead } from '@/features/schedule/lib/month-progress-overhead'
import {
  plannedPercentAsOf,
  progressWeightOf,
  resolveProgressBasis,
  type EvmActivity,
} from '@/features/evm/lib/metrics'
import {
  accrueOverheadAsOf,
  closedOverheadMonths,
  contractorExecutedAsOf,
  jalaliMonthStartIso,
  progressPercentAsOf,
  purchasesAsOf,
  type ContractorActivityCost,
  type OverheadMonthAmount,
} from '@/features/finance/lib/live-workshop-cost'
import type { EmployerPurchase } from '@/features/finance/lib/employer-purchases'

/**
 * A schedule item seen by cost: its contract value (contractor cost), its EVM budget and weight
 * (PV / EV) and its progress history (contractor cost, overhead share and material consumption).
 */
export type CostActivity = ContractorActivityCost &
  EvmActivity & {
    wbs: string | null
  }

export type CostCurvePoint = {
  date: string
  isToday: boolean
  /** Cumulative actual cost layers; null after today. */
  overhead: number | null
  contractor: number | null
  purchases: number | null
  total: number | null
  /** BAC × weighted planned % (same basis as the EVM dashboard); null without a budget. */
  planned: number | null
  /** BAC × weighted earned %; null after today or without a budget. */
  earned: number | null
}

export type ItemCostRow = {
  id: string
  wbs: string | null
  name: string
  percent: number
  contractor: number
  overhead: number
  /** Employer purchases shared to this item, in full. */
  purchaseAllocated: number
  /** Allocated × the item's progress: the part already built in. */
  purchaseConsumed: number
  /** contractor + overhead + purchaseConsumed */
  total: number
}

export type ItemCostModel = {
  rows: ItemCostRow[]
  /** Overhead of months in which no item earned weight; it belongs to no item. */
  unallocatedOverhead: number
  /** Purchased but not yet built in (allocated − consumed, plus shares of removed items). */
  materialsOnSite: number
}

const DAY_MS = 86_400_000

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function minDate(dates: Array<string | null | undefined>): string | null {
  return dates.map((d) => toIsoDateOnly(d ?? null)).filter((d): d is string => !!d).sort()[0] ?? null
}

function maxDate(dates: Array<string | null | undefined>): string | null {
  const sorted = dates.map((d) => toIsoDateOnly(d ?? null)).filter((d): d is string => !!d).sort()
  return sorted[sorted.length - 1] ?? null
}

function dayCount(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS) + 1
}

/**
 * Overhead accrued by a past date: each closed month spread evenly over its days, plus the current
 * month's estimate. On today it equals `accrueOverheadAsOf`.
 */
function overheadAccruedOn(months: OverheadMonthAmount[], dateIso: string, today: string): number {
  const closed = closedOverheadMonths(months, today).reduce((sum, m) => {
    if (dateIso < m.startIso) return sum
    if (dateIso >= m.endIso) return sum + m.amountToman
    const length = dayCount(m.startIso, m.endIso)
    return length > 0 ? sum + (m.amountToman * dayCount(m.startIso, dateIso)) / length : sum
  }, 0)
  return round(closed + accrueOverheadAsOf(months, dateIso, today).estimated)
}

/** Weighted planned and earned percent on a date, earned read from the progress history. */
function weightedPercentsOn(
  activities: CostActivity[],
  dateIso: string,
  todayIso: string
): { planned: number; earned: number } {
  const basis = resolveProgressBasis(activities)
  let total = 0
  let planned = 0
  let earned = 0
  for (const a of activities) {
    const w = progressWeightOf(a, basis)
    if (w <= 0) continue
    total += w
    planned += w * plannedPercentAsOf(a.baselineStart, a.baselineFinish, dateIso)
    earned += w * progressPercentAsOf(a, dateIso, todayIso)
  }
  return total > 0 ? { planned: planned / total, earned: earned / total } : { planned: 0, earned: 0 }
}

/**
 * Weekly cumulative workshop cost from the project start to today, layered by source, with the
 * planned (PV) line continuing to the baseline finish and the earned (EV) line up to today.
 */
export function buildCostCurve(input: {
  overheadMonths: OverheadMonthAmount[]
  activities: CostActivity[]
  purchases: Array<{ date: string; amount: number }>
  todayIso: string
}): CostCurvePoint[] {
  const today = toIsoDateOnly(input.todayIso)
  if (!today) return []
  const closed = closedOverheadMonths(input.overheadMonths, today).filter((m) => m.amountToman > 0)
  const start = minDate([
    closed[0]?.startIso,
    ...input.activities.flatMap((a) => [a.start, a.baselineStart, ...a.progressHistory.map((p) => p.date)]),
    ...input.purchases.map((p) => p.date),
  ])
  if (!start || start > today) return []
  const planEnd = maxDate([today, ...input.activities.map((a) => a.baselineFinish)]) ?? today
  const bac = input.activities.reduce((sum, a) => sum + Math.max(0, Number(a.budget) || 0), 0)

  const dates: string[] = []
  for (let d = start; d < today; d = addDays(d, 7)) dates.push(d)
  dates.push(today)
  for (let d = addDays(today, 7); d < planEnd; d = addDays(d, 7)) dates.push(d)
  if (planEnd > today) dates.push(planEnd)

  return dates.map((date) => {
    const past = date <= today
    const percents = bac > 0 ? weightedPercentsOn(input.activities, date, today) : null
    const point: CostCurvePoint = {
      date,
      isToday: date === today,
      overhead: null,
      contractor: null,
      purchases: null,
      total: null,
      planned: percents ? round((bac * percents.planned) / 100) : null,
      earned: percents && past ? round((bac * percents.earned) / 100) : null,
    }
    if (!past) return point
    point.overhead = overheadAccruedOn(input.overheadMonths, date, today)
    point.contractor = contractorExecutedAsOf(input.activities, date, today)
    point.purchases = purchasesAsOf(input.purchases, date)
    point.total = round(point.overhead + point.contractor + point.purchases)
    return point
  })
}

/** Accrued overhead per month up to today: closed months as recorded, the current month as estimated. */
function accruedOverheadPeriods(
  months: OverheadMonthAmount[],
  today: string
): Array<{ startIso: string; endIso: string; amount: number }> {
  const periods = closedOverheadMonths(months, today).map((m) => ({
    startIso: m.startIso,
    endIso: m.endIso,
    amount: m.amountToman,
  }))
  const currentStart = jalaliMonthStartIso(today)
  const estimated = accrueOverheadAsOf(months, today, today).estimated
  if (currentStart && estimated > 0) periods.push({ startIso: currentStart, endIso: today, amount: estimated })
  return periods
}

/**
 * Cost of each schedule item up to today:
 * - contractor = contract value × progress
 * - overhead = each month's overhead × the item's share of the weight earned that month
 * - employer purchases = amount × share, built in as the item progresses
 * The rows plus unallocated overhead plus materials on site add up to the live total.
 */
export function buildItemCosts(input: {
  overheadMonths: OverheadMonthAmount[]
  activities: CostActivity[]
  purchases: EmployerPurchase[]
  todayIso: string
}): ItemCostModel {
  const today = toIsoDateOnly(input.todayIso) ?? input.todayIso
  const activities = input.activities
  const rows = new Map<string, ItemCostRow>(
    activities.map((a) => {
      const percent = progressPercentAsOf(a, today, today)
      return [
        a.id,
        {
          id: a.id,
          wbs: a.wbs,
          name: a.name,
          percent,
          contractor: round(a.contractValue * (percent / 100)),
          overhead: 0,
          purchaseAllocated: 0,
          purchaseConsumed: 0,
          total: 0,
        },
      ]
    })
  )

  let unallocatedOverhead = 0
  for (const period of accruedOverheadPeriods(input.overheadMonths, today)) {
    const before = addDays(period.startIso, -1)
    const end = period.endIso < today ? period.endIso : today
    const parts = activities.map((a) => {
      const w = Math.max(0, Number(a.weight) || 0)
      const gained = progressPercentAsOf(a, end, today) - progressPercentAsOf(a, before, today)
      return gained > 0 ? (w * gained) / 100 : 0
    })
    if (!(parts.reduce((s, p) => s + p, 0) > 0)) {
      unallocatedOverhead += period.amount
      continue
    }
    allocateOverhead(period.amount, parts).forEach((share, i) => {
      const row = rows.get(activities[i]!.id)
      if (row) row.overhead += share
    })
  }

  let materialsOnSite = 0
  for (const purchase of input.purchases) {
    if ((toIsoDateOnly(purchase.purchaseDate) ?? '') > today) continue
    let left = purchase.amount
    purchase.allocations.forEach((allocation, i) => {
      const share =
        i === purchase.allocations.length - 1 ? left : Math.round((purchase.amount * allocation.sharePercent) / 100)
      left -= share
      const row = allocation.taskId ? rows.get(allocation.taskId) : undefined
      if (!row) {
        materialsOnSite += share
        return
      }
      const consumed = share * (row.percent / 100)
      row.purchaseAllocated += share
      row.purchaseConsumed += consumed
      materialsOnSite += share - consumed
    })
  }

  const out = [...rows.values()].map((row) => {
    const overhead = round(row.overhead)
    const purchaseAllocated = round(row.purchaseAllocated)
    const purchaseConsumed = round(row.purchaseConsumed)
    return {
      ...row,
      overhead,
      purchaseAllocated,
      purchaseConsumed,
      total: round(row.contractor + overhead + purchaseConsumed),
    }
  })
  return {
    rows: out.filter((r) => r.contractor > 0 || r.overhead > 0 || r.purchaseAllocated > 0),
    unallocatedOverhead: round(unallocatedOverhead),
    materialsOnSite: round(materialsOnSite),
  }
}
