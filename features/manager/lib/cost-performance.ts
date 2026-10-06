import type { EvmBudgetBasis } from '@/features/evm/lib/metrics'

export type CostTone = 'good' | 'warn' | 'bad' | 'neutral'

export interface CostPerformanceInput {
  bac: number
  /** Cost-basis earned value, Σ(budgetᵢ × physical٪ᵢ). */
  ev: number
  ac: number
  budgetBasis: EvmBudgetBasis
}

interface CostBase {
  bac: number
  ev: number
  remainingWork: number
  evPercent: number
}

export interface CostPerformanceReady extends CostBase {
  status: 'ok'
  ac: number
  cpi: number
  /** Null when the budget is spent while work remains (TCPI → ∞). */
  tcpi: number | null
  cv: number
  /** BAC ÷ CPI; null while nothing is earned (CPI = 0 makes the forecast unbounded). */
  eac: number | null
  vac: number | null
  remainingBudget: number
  acPercent: number
  /** Overrun at completion as % of BAC; ≤ 0 means on or under budget. */
  overrunPercent: number | null
  cpiTone: CostTone
  tcpiTone: CostTone
  bannerTone: CostTone
}

export type CostPerformance =
  | { status: 'no_budget' }
  | ({ status: 'no_actual_cost' } & CostBase)
  | CostPerformanceReady

/** CPI: higher is better. */
export const CPI_ZONES = { critical: 0.9, healthy: 1 } as const
/** TCPI is a requirement, never a result, so it is never green. */
export const TCPI_ZONES = { reachable: 1, stretch: 1.1 } as const
export const BANNER_OVERRUN_CRITICAL_PERCENT = 10

export function cpiTone(cpi: number): CostTone {
  if (cpi >= CPI_ZONES.healthy) return 'good'
  if (cpi >= CPI_ZONES.critical) return 'warn'
  return 'bad'
}

export function tcpiTone(tcpi: number | null): CostTone {
  if (tcpi == null) return 'bad'
  if (tcpi <= TCPI_ZONES.reachable) return 'neutral'
  if (tcpi <= TCPI_ZONES.stretch) return 'warn'
  return 'bad'
}

export function buildCostPerformance(input: CostPerformanceInput): CostPerformance {
  const { bac, ev, ac } = input
  if (input.budgetBasis === 'none' || !(bac > 0)) return { status: 'no_budget' }

  const base: CostBase = {
    bac,
    ev,
    remainingWork: Math.max(bac - ev, 0),
    evPercent: (ev / bac) * 100,
  }
  if (!(ac > 0)) return { status: 'no_actual_cost', ...base }

  const cpi = ev / ac
  const remainingBudget = bac - ac
  const tcpi = ev >= bac ? 0 : remainingBudget > 0 ? (bac - ev) / remainingBudget : null
  const eac = cpi > 0 ? bac / cpi : null
  const vac = eac == null ? null : bac - eac
  const overrunPercent = vac == null ? null : (-vac / bac) * 100

  return {
    status: 'ok',
    ...base,
    ac,
    cpi,
    tcpi,
    cv: ev - ac,
    eac,
    vac,
    remainingBudget,
    acPercent: (ac / bac) * 100,
    overrunPercent,
    cpiTone: cpiTone(cpi),
    tcpiTone: tcpiTone(tcpi),
    bannerTone:
      vac == null || overrunPercent == null
        ? 'bad'
        : vac >= 0
          ? 'good'
          : overrunPercent >= BANNER_OVERRUN_CRITICAL_PERCENT
            ? 'bad'
            : 'warn',
  }
}

export interface MoneyScale {
  divisor: number
  unit: string
}

/** One shared unit for every number in the section, picked from the largest amount (Toman). */
export function moneyScale(max: number): MoneyScale {
  const abs = Math.abs(max)
  if (abs >= 1e9) return { divisor: 1e9, unit: 'میلیارد تومان' }
  if (abs >= 1e6) return { divisor: 1e6, unit: 'میلیون تومان' }
  if (abs >= 1e3) return { divisor: 1e3, unit: 'هزار تومان' }
  return { divisor: 1, unit: 'تومان' }
}
