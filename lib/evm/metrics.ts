import { toIsoDateOnly } from '@/lib/schedule/dates'
import { CALENDAR_DAYS, plannedPercentInWindow, type WorkCalendar } from '@/lib/schedule/planned-progress'

export type EvmCostSource = 'expense' | 'vendor_bill' | 'overhead'

export const EVM_COST_SOURCES: readonly EvmCostSource[] = ['expense', 'vendor_bill', 'overhead']

/** Budget basis used for BAC: priced schedule lines, or project budget spread by MSP weight. */
export type EvmBudgetBasis = 'technical_office_cost' | 'contract_value' | 'weighted_project_budget' | 'none'

export interface EvmActivity {
  id: string
  name: string
  /** Budget at completion for this activity (Toman). */
  budget: number
  baselineStart: string | null
  baselineFinish: string | null
  /** Physical progress approved by the technical office (0–100). */
  physicalPercent: number
  /** Project-level schedule weight (MSP وزن, percent-points); drives PV, EV and SPI. */
  weight?: number
}

/**
 * PV, EV and SPI use normalized schedule weights (the same basis as «پیشرفت تجمعی»). Budgets
 * are used only for cost: evAmount = Σ(budget × physical %), CPI and TCPI. When no activity
 * carries a weight, budgets stand in as weights.
 */
export type EvmProgressBasis = 'schedule_weight' | 'budget'

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
  progressBasis: EvmProgressBasis
  bac: number
  /** BAC × planned % (schedule-weight basis). */
  pv: number
  /** BAC × earned % (schedule-weight basis); SPI = EV ÷ PV. */
  ev: number
  /** Σ(budget × physical %): the cost-basis earned value used by CV, CPI and TCPI. */
  evAmount: number
  ac: number
  /** EV − PV */
  sv: number
  /** evAmount − AC */
  cv: number
  /** earned % ÷ planned % — null when nothing is planned yet. */
  spi: number | null
  /** evAmount ÷ AC — null unless AC > 0 and the budget is real. */
  cpi: number | null
  /** Σ wᵢ·plannedᵢ ÷ Σ wᵢ */
  plannedPercent: number
  /** Σ wᵢ·physicalᵢ ÷ Σ wᵢ (equals «پیشرفت تجمعی») */
  earnedPercent: number
  /** Σ wᵢ of the activities in the progress basis. */
  totalWeight: number
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

/** Baseline planned percent as of a date — see `lib/schedule/planned-progress.ts` for the convention. */
export function plannedPercentAsOf(
  baselineStart: string | null,
  baselineFinish: string | null,
  asOfIso: string,
  calendar: WorkCalendar = CALENDAR_DAYS
): number {
  return plannedPercentInWindow({ start: baselineStart, finish: baselineFinish }, asOfIso, calendar)
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
 * Per-activity budgets. The technical office's activity cost (MSP Cost column) wins; then priced
 * lines (quantity × unit price); when neither exists, the project budget is spread by MSP weight
 * so SPI still works.
 */
export function resolveActivityBudgets<T extends { contractValue: number; weight: number; mspCost?: number }>(
  items: T[],
  projectBudget: number | null
): { basis: EvmBudgetBasis; budgets: number[] } {
  const costed = items.reduce((sum, item) => sum + Math.max(0, finite(item.mspCost)), 0)
  if (costed > 0) {
    return {
      basis: 'technical_office_cost',
      budgets: items.map((item) => Math.max(0, finite(item.mspCost))),
    }
  }
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

/** The weight each activity carries in PV/EV/SPI under the chosen progress basis. */
export function progressWeightOf(activity: EvmActivity, basis: EvmProgressBasis): number {
  return Math.max(0, finite(basis === 'schedule_weight' ? activity.weight : activity.budget))
}

export function resolveProgressBasis(activities: EvmActivity[]): EvmProgressBasis {
  return activities.some((a) => finite(a.weight) > 0) ? 'schedule_weight' : 'budget'
}

/** Σ wᵢ·pᵢ ÷ Σ wᵢ for planned (as of a date) and earned percent. */
export function weightedPercents(
  activities: EvmActivity[],
  asOfIso: string,
  basis: EvmProgressBasis = resolveProgressBasis(activities)
): { plannedPercent: number; earnedPercent: number; totalWeight: number } {
  let totalWeight = 0
  let planned = 0
  let earned = 0
  for (const a of activities) {
    const w = progressWeightOf(a, basis)
    if (w <= 0) continue
    totalWeight += w
    planned += w * plannedPercentAsOf(a.baselineStart, a.baselineFinish, asOfIso)
    earned += w * clampPercent(a.physicalPercent)
  }
  if (totalWeight <= 0) return { plannedPercent: 0, earnedPercent: 0, totalWeight: 0 }
  return { plannedPercent: planned / totalWeight, earnedPercent: earned / totalWeight, totalWeight }
}

export function computeEvmMetrics(input: {
  activities: EvmActivity[]
  costs: EvmCostEntry[]
  asOf: string
  budgetBasis: EvmBudgetBasis
}): EvmMetrics {
  const asOf = toIsoDateOnly(input.asOf) ?? input.asOf
  const progressBasis = resolveProgressBasis(input.activities)
  const progress = input.activities.filter((a) => progressWeightOf(a, progressBasis) > 0)
  const { plannedPercent, earnedPercent, totalWeight } = weightedPercents(progress, asOf, progressBasis)

  const budgeted = input.activities.filter((a) => finite(a.budget) > 0)
  const bac = budgeted.reduce((sum, a) => sum + finite(a.budget), 0)
  const evAmount = computeEarnedValue(budgeted)
  const pv = (bac * plannedPercent) / 100
  const ev = (bac * earnedPercent) / 100
  const actual = computeActualCost(input.costs, asOf)
  const budgetBasis = bac > 0 ? input.budgetBasis : 'none'

  return {
    asOf,
    budgetBasis,
    progressBasis,
    bac,
    pv,
    ev,
    evAmount,
    ac: actual.total,
    sv: ev - pv,
    cv: evAmount - actual.total,
    spi: safeRatio(earnedPercent, plannedPercent),
    cpi: actual.total > 0 && budgetBasis !== 'none' ? safeRatio(evAmount, actual.total) : null,
    plannedPercent,
    earnedPercent,
    totalWeight,
    acBySource: actual.bySource,
    activityCount: progress.length,
  }
}
