import { describe, expect, it } from 'vitest'
import { breakdownActivities, computeEvmMetrics, type EvmActivity } from '@/features/evm/lib/metrics'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import { buildExplainedCumulativeProgress, CUMULATIVE_FORMULA_LATEX } from '@/features/project-controls/lib/cumulative-progress'
import { NOOR_ACTIVITIES, NOOR_PROJECT_ID, NOOR_STATUS_DATE } from '../fixtures/noor-2026-10-03'

function evmOf(activities: EvmActivity[], asOf = NOOR_STATUS_DATE): ProjectEvmSnapshot {
  const metrics = computeEvmMetrics({ activities, costs: [], asOf, budgetBasis: 'contract_value' })
  const rows = breakdownActivities(activities, asOf).map((row, i) => ({ ...row, weight: activities[i]!.weight, kind: 'task', wbs: String(i + 1) }))
  return { projectId: NOOR_PROJECT_ID, metrics, activities: rows, weightIssues: [] } as unknown as ProjectEvmSnapshot
}

describe('explained cumulative progress — Noor 2026-10-03', () => {
  const evm = evmOf(NOOR_ACTIVITIES)
  const result = buildExplainedCumulativeProgress(evm)

  it('totals equal the EVM engine (the dashboard card) exactly', () => {
    expect(result.status).toBe('ok')
    expect(result.planned_cum_percent).toBeCloseTo(evm.metrics.plannedPercent, 12)
    expect(result.actual_cum_percent).toBeCloseTo(evm.metrics.earnedPercent, 12)
    expect(result.actual_cum_percent).toBeCloseTo(74.05, 12)
    expect(result.planned_cum_percent).toBe(100)
    expect(result.formula_latex).toBe(CUMULATIVE_FORMULA_LATEX)
  })

  it('each column of the breakdown sums to the final number', () => {
    const rows = result.breakdown_table
    expect(rows).toHaveLength(17)
    expect(rows.reduce((s, r) => s + r.weight_percentage, 0)).toBeCloseTo(100, 10)
    expect(rows.reduce((s, r) => s + r.weighted_actual, 0)).toBeCloseTo(result.actual_cum_percent!, 12)
    expect(rows.reduce((s, r) => s + r.weighted_planned, 0)).toBeCloseTo(result.planned_cum_percent!, 12)
    const walls = rows.find((r) => r.task_name === 'دیوار 35 سانتی')!
    expect(walls.weight).toBe(11)
    expect(walls.weight_percentage).toBeCloseTo(11, 12)
    expect(walls.weighted_actual).toBeCloseTo(0.11 * 45, 12)
    expect(walls.actual_source).toBe('current')
  })

  it('PV and EV scale BAC by the cumulative percents', () => {
    expect(result.bac_total).toBe(3300)
    expect(result.pv_value).toBeCloseTo(3300, 9)
    expect(result.ev_value).toBeCloseTo(3300 * 0.7405, 9)
    expect(result.ev_value).toBeCloseTo(evm.metrics.ev, 9)
  })

  it('substitution shows normalized weights and ends with the result', () => {
    expect(result.substitution_text.startsWith('( (0.11 × 45%) + (0.06 × 65%) + (0.05 × 100%)')).toBe(true)
    expect(result.substitution_text.endsWith('/ 1.00 = 74.05%')).toBe(true)
    expect(result.substitution_planned_text.endsWith('= 100.00%')).toBe(true)
  })

  it('interpretation states the gap and the EV lag in Toman', () => {
    expect(result.interpretation_fa).toContain('عقب‌تر از')
    expect(result.interpretation_fa).toContain('EV Lag')
    expect(result.interpretation_fa).toContain(Math.round(3300 - 3300 * 0.7405).toLocaleString('en-US'))
  })
})

describe('explained cumulative progress — past date and missing data', () => {
  it('past as-of uses the latest record and counts rows without one as 0, with a warning', () => {
    const evm = evmOf(NOOR_ACTIVITIES, '2026-03-01')
    const first = NOOR_ACTIVITIES[2]!.id
    const history = new Map([[first, { percent: 100, source: 'record' as const }]])
    const result = buildExplainedCumulativeProgress(evm, history)
    expect(result.actual_cum_percent).toBeCloseTo(5, 12)
    expect(result.breakdown_table.find((r) => r.activity_id === first)!.actual_source).toBe('record')
    expect(result.breakdown_table.filter((r) => r.actual_source === 'no_record')).toHaveLength(16)
    expect(result.warnings_fa.some((w) => w.includes('صفر منظور'))).toBe(true)
  })

  it('no weights and no budgets: data_missing with the reason', () => {
    const result = buildExplainedCumulativeProgress(evmOf(NOOR_ACTIVITIES.map((a) => ({ ...a, weight: 0, budget: 0 }))))
    expect(result.status).toBe('data_missing')
    expect(result.actual_cum_percent).toBeNull()
    expect(result.reason_fa).toContain('ΣW')
  })

  it('no budget: percents still computed, PV/EV null and explained', () => {
    const result = buildExplainedCumulativeProgress(evmOf(NOOR_ACTIVITIES.map((a) => ({ ...a, budget: 0 }))))
    expect(result.actual_cum_percent).toBeCloseTo(74.05, 12)
    expect(result.ev_value).toBeNull()
    expect(result.interpretation_fa).toContain('BAC')
  })
})
