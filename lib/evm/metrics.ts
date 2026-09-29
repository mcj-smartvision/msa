import { toIsoDateOnly } from '@/lib/schedule/dates'
import { inclusiveDayCount } from '@/lib/schedule/monthly-deducted-weight'

export type EvmCostSource = 'expense' | 'vendor_bill' | 'overhead'

export const EVM_COST_SOURCES: readonly EvmCostSource[] = ['expense', 'vendor_bill', 'overhead']

/** Budget basis used for BAC: priced schedule lines, or project budget spread by MSP weight. */
export type EvmBudgetBasis = 'contract_value' | 'weighted_project_budget' | 'none'

export interface EvmActivity {
  id: string
  name: string
  /** Budget at completion for this activity (Toman). */
  budget: number
  baselineStart: string | null
  baselineFinish: string | null
  /** Physical progress approved by the technical office (0–100). */
  physicalPercent: number
}

export interface EvmCostEntry {
  source: EvmCostSource
  /** ISO date the cost was incurred. */
  date: string
  /** Toman. */
  amount: number
  /** Record reference shown to the user, e.g. document number or vendor name. */
  label?: string
  note?: string
}

export interface EvmActivityBreakdown extends EvmActivity {
  plannedPercent: number
  pv: number
  ev: number
}

export interface EvmMetrics {
  asOf: string
  budgetBasis: EvmBudgetBasis
  bac: number
  pv: number
  ev: number
  ac: number
  /** EV − PV */
  sv: number
  /** EV − AC */
  cv: number
  /** EV / PV — null when PV is zero. */
  spi: number | null
  /** EV / AC — null when AC is zero. */
  cpi: number | null
  plannedPercent: number
  earnedPercent: number
  acBySource: Record<EvmCostSource, number>
  activityCount: number
}

function finite(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, finite(value)))
}

/** num / den, or null when the ratio is undefined (zero or non-finite denominator). */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null
  }
  return numerator / denominator
}

/**
 * Linear baseline progress: 0 before start, 100 on/after finish, and the share of
 * elapsed calendar days (both ends inclusive) in between.
 */
export function plannedPercentAsOf(
  baselineStart: string | null,
  baselineFinish: string | null,
  asOfIso: string
): number {
  const start = toIsoDateOnly(baselineStart)
  const finish = toIsoDateOnly(baselineFinish) ?? start
  const asOf = toIsoDateOnly(asOfIso)
  if (!start || !finish || !asOf) return 0
  if (asOf < start) return 0
  if (asOf >= finish) return 100
  const total = inclusiveDayCount(start, finish)
  if (total <= 0) return 100
  return clampPercent((inclusiveDayCount(start, asOf) / total) * 100)
}

/** Per-activity PV and EV — the rows that sum to the project PV and EV. */
export function breakdownActivities<T extends EvmActivity>(
  activities: T[],
  asOfIso: string
): Array<T & EvmActivityBreakdown> {
  return activities.map((a) => {
    const budget = finite(a.budget)
    const plannedPercent = plannedPercentAsOf(a.baselineStart, a.baselineFinish, asOfIso)
    const physicalPercent = clampPercent(a.physicalPercent)
    return {
      ...a,
      physicalPercent,
      plannedPercent,
      pv: budget * (plannedPercent / 100),
      ev: budget * (physicalPercent / 100),
    }
  })
}

export function computePlannedValue(activities: EvmActivity[], asOfIso: string): number {
  return breakdownActivities(activities, asOfIso).reduce((sum, a) => sum + a.pv, 0)
}

export function computeEarnedValue(activities: EvmActivity[]): number {
  return activities.reduce(
    (sum, a) => sum + finite(a.budget) * (clampPercent(a.physicalPercent) / 100),
    0
  )
}

export function computeActualCost(
  costs: EvmCostEntry[],
  asOfIso: string
): { total: number; bySource: Record<EvmCostSource, number> } {
  const asOf = toIsoDateOnly(asOfIso)
  const bySource: Record<EvmCostSource, number> = { expense: 0, vendor_bill: 0, overhead: 0 }
  for (const cost of costs) {
    const date = toIsoDateOnly(cost.date)
    if (!asOf || !date || date > asOf) continue
    const amount = finite(cost.amount)
    if (amount <= 0) continue
    bySource[cost.source] += amount
  }
  const total = EVM_COST_SOURCES.reduce((sum, key) => sum + bySource[key], 0)
  return { total, bySource }
}

/**
 * Per-activity budgets. Priced lines (quantity × unit price) win; when none are priced,
 * the project budget is spread by MSP weight so SPI still works.
 */
export function resolveActivityBudgets<T extends { contractValue: number; weight: number }>(
  items: T[],
  projectBudget: number | null
): { basis: EvmBudgetBasis; budgets: number[] } {
  const priced = items.reduce((sum, item) => sum + Math.max(0, finite(item.contractValue)), 0)
  if (priced > 0) {
    return {
      basis: 'contract_value',
      budgets: items.map((item) => Math.max(0, finite(item.contractValue))),
    }
  }
  const budget = finite(projectBudget)
  const weightSum = items.reduce((sum, item) => sum + Math.max(0, finite(item.weight)), 0)
  if (budget > 0 && weightSum > 0) {
    return {
      basis: 'weighted_project_budget',
      budgets: items.map((item) => (budget * Math.max(0, finite(item.weight))) / weightSum),
    }
  }
  return { basis: 'none', budgets: items.map(() => 0) }
}

export function computeEvmMetrics(input: {
  activities: EvmActivity[]
  costs: EvmCostEntry[]
  asOf: string
  budgetBasis: EvmBudgetBasis
}): EvmMetrics {
  const asOf = toIsoDateOnly(input.asOf) ?? input.asOf
  const activities = input.activities.filter((a) => finite(a.budget) > 0)
  const bac = activities.reduce((sum, a) => sum + finite(a.budget), 0)
  const pv = computePlannedValue(activities, asOf)
  const ev = computeEarnedValue(activities)
  const actual = computeActualCost(input.costs, asOf)

  return {
    asOf,
    budgetBasis: bac > 0 ? input.budgetBasis : 'none',
    bac,
    pv,
    ev,
    ac: actual.total,
    sv: ev - pv,
    cv: ev - actual.total,
    spi: safeRatio(ev, pv),
    cpi: safeRatio(ev, actual.total),
    plannedPercent: bac > 0 ? (pv / bac) * 100 : 0,
    earnedPercent: bac > 0 ? (ev / bac) * 100 : 0,
    acBySource: actual.bySource,
    activityCount: activities.length,
  }
}
