import { describe, expect, it } from 'vitest'
import {
breakdownActivities,
computeActualCost,
computeEvmMetrics,
plannedPercentAsOf,
resolveActivityBudgets,
safeRatio,
type EvmActivity,
} from '@/features/evm/lib/metrics'

describe('safeRatio', () => {
  it('returns null for zero or invalid denominators', () => {
    expect(safeRatio(10, 0)).toBeNull()
    expect(safeRatio(10, -5)).toBeNull()
    expect(safeRatio(10, Number.NaN)).toBeNull()
    expect(safeRatio(0, 10)).toBe(0)
    expect(safeRatio(9, 10)).toBeCloseTo(0.9)
  })
})

describe('plannedPercentAsOf', () => {
  it('is 0 before start and 100 on/after finish', () => {
    expect(plannedPercentAsOf('2026-01-10', '2026-01-19', '2026-01-09')).toBe(0)
    expect(plannedPercentAsOf('2026-01-10', '2026-01-19', '2026-01-19')).toBe(100)
    expect(plannedPercentAsOf('2026-01-10', '2026-01-19', '2026-02-01')).toBe(100)
  })

  it('counts both ends inclusively in between', () => {
    // 10 days total; day 5 elapsed → 50%
    expect(plannedPercentAsOf('2026-01-10', '2026-01-19', '2026-01-14')).toBeCloseTo(50)
  })

  it('treats missing dates as not planned', () => {
    expect(plannedPercentAsOf(null, null, '2026-01-14')).toBe(0)
  })
})

describe('computeActualCost', () => {
  it('sums costs up to asOf by source', () => {
    const result = computeActualCost(
      [
        { source: 'expense', date: '2026-01-01', amount: 100 },
        { source: 'vendor_bill', date: '2026-01-05', amount: 50 },
        { source: 'expense', date: '2026-02-01', amount: 999 },
        { source: 'overhead', date: '2026-01-10', amount: -5 },
      ],
      '2026-01-31'
    )
    expect(result.total).toBe(150)
    expect(result.bySource).toEqual({ expense: 100, vendor_bill: 50, overhead: 0 })
  })
})

describe('resolveActivityBudgets', () => {
  it('prefers priced lines', () => {
    const r = resolveActivityBudgets(
      [
        { contractValue: 300, weight: 10 },
        { contractValue: 0, weight: 90 },
      ],
      1_000_000
    )
    expect(r.basis).toBe('contract_value')
    expect(r.budgets).toEqual([300, 0])
  })

  it('spreads the project budget by weight when nothing is priced', () => {
    const r = resolveActivityBudgets(
      [
        { contractValue: 0, weight: 25 },
        { contractValue: 0, weight: 75 },
      ],
      1000
    )
    expect(r.basis).toBe('weighted_project_budget')
    expect(r.budgets).toEqual([250, 750])
  })

  it('has no basis without prices or project budget', () => {
    expect(resolveActivityBudgets([{ contractValue: 0, weight: 50 }], null).basis).toBe('none')
  })
})

describe('computeEvmMetrics', () => {
  const activities: EvmActivity[] = [
    {
      id: 'a',
      name: 'Done activity',
      budget: 1000,
      baselineStart: '2026-01-01',
      baselineFinish: '2026-01-10',
      physicalPercent: 100,
    },
    {
      id: 'b',
      name: 'Half-planned activity',
      budget: 1000,
      baselineStart: '2026-01-11',
      baselineFinish: '2026-01-20',
      physicalPercent: 20,
    },
  ]

  it('computes PV, EV, AC, SPI and CPI', () => {
    const m = computeEvmMetrics({
      activities,
      costs: [{ source: 'expense', date: '2026-01-10', amount: 1500 }],
      asOf: '2026-01-15',
      budgetBasis: 'contract_value',
    })
    expect(m.bac).toBe(2000)
    expect(m.pv).toBeCloseTo(1500) // 1000 + 50% of 1000
    expect(m.ev).toBeCloseTo(1200) // 1000 + 20% of 1000
    expect(m.ac).toBe(1500)
    expect(m.spi).toBeCloseTo(0.8)
    expect(m.cpi).toBeCloseTo(0.8)
    expect(m.sv).toBeCloseTo(-300)
    expect(m.plannedPercent).toBeCloseTo(75)
    expect(m.earnedPercent).toBeCloseTo(60)
  })

  it('returns null indices when PV or AC is zero', () => {
    const m = computeEvmMetrics({
      activities,
      costs: [],
      asOf: '2025-12-01',
      budgetBasis: 'contract_value',
    })
    expect(m.pv).toBe(0)
    expect(m.spi).toBeNull()
    expect(m.cpi).toBeNull()
  })

  it('breakdown rows sum to the project PV and EV', () => {
    const rows = breakdownActivities(activities, '2026-01-15')
    expect(rows.map((r) => r.plannedPercent)).toEqual([100, 50])
    expect(rows.reduce((s, r) => s + r.pv, 0)).toBeCloseTo(1500)
    expect(rows.reduce((s, r) => s + r.ev, 0)).toBeCloseTo(1200)
  })

  it('ignores activities without budget', () => {
    const m = computeEvmMetrics({
      activities: [{ ...activities[0]!, budget: 0 }],
      costs: [],
      asOf: '2026-01-15',
      budgetBasis: 'contract_value',
    })
    expect(m.activityCount).toBe(0)
    expect(m.budgetBasis).toBe('none')
  })
})
