import { describe, expect, it } from 'vitest'
import { buildCostPerformance, cpiTone, moneyScale, tcpiTone } from '@/lib/manager/cost-performance'

describe('buildCostPerformance', () => {
  it('matches the reference design numbers (BAC 100, AC 71.5, EV 65)', () => {
    const r = buildCostPerformance({ bac: 100, ev: 65, ac: 71.5, budgetBasis: 'technical_office_cost' })
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.cpi).toBeCloseTo(0.909, 3)
    expect(r.tcpi).toBeCloseTo(35 / 28.5, 6)
    expect(r.cv).toBeCloseTo(-6.5, 6)
    expect(r.eac).toBeCloseTo(110, 6)
    expect(r.vac).toBeCloseTo(-10, 6)
    expect(r.overrunPercent).toBeCloseTo(10, 6)
    expect(r.cpiTone).toBe('warn')
    expect(r.tcpiTone).toBe('bad')
    expect(r.bannerTone).toBe('bad')
  })

  it('reports missing actual cost instead of inventing CPI/TCPI', () => {
    const r = buildCostPerformance({ bac: 3000, ev: 2627.9, ac: 0, budgetBasis: 'technical_office_cost' })
    expect(r.status).toBe('no_actual_cost')
    if (r.status !== 'no_actual_cost') return
    expect(r.remainingWork).toBeCloseTo(372.1, 6)
    expect(r.evPercent).toBeCloseTo(87.597, 2)
  })

  it('reports a missing budget', () => {
    expect(buildCostPerformance({ bac: 0, ev: 0, ac: 10, budgetBasis: 'none' }).status).toBe('no_budget')
    expect(buildCostPerformance({ bac: 100, ev: 0, ac: 10, budgetBasis: 'none' }).status).toBe('no_budget')
  })

  it('flags an exhausted budget as TCPI = null (unreachable)', () => {
    const r = buildCostPerformance({ bac: 100, ev: 80, ac: 120, budgetBasis: 'contract_value' })
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.tcpi).toBeNull()
    expect(r.tcpiTone).toBe('bad')
  })

  it('leaves EAC empty while nothing is earned', () => {
    const r = buildCostPerformance({ bac: 100, ev: 0, ac: 5, budgetBasis: 'contract_value' })
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.cpi).toBe(0)
    expect(r.eac).toBeNull()
    expect(r.vac).toBeNull()
  })

  it('is green and on budget when CPI ≥ 1', () => {
    const r = buildCostPerformance({ bac: 100, ev: 50, ac: 40, budgetBasis: 'contract_value' })
    if (r.status !== 'ok') throw new Error(r.status)
    expect(r.cpiTone).toBe('good')
    expect(r.tcpiTone).toBe('neutral')
    expect(r.bannerTone).toBe('good')
  })
})

describe('tones and scale', () => {
  it('uses the design thresholds', () => {
    expect(cpiTone(1)).toBe('good')
    expect(cpiTone(0.9)).toBe('warn')
    expect(cpiTone(0.89)).toBe('bad')
    expect(tcpiTone(1)).toBe('neutral')
    expect(tcpiTone(1.1)).toBe('warn')
    expect(tcpiTone(1.11)).toBe('bad')
  })

  it('picks one unit from the largest amount', () => {
    expect(moneyScale(110e9).unit).toBe('میلیارد تومان')
    expect(moneyScale(5e6).divisor).toBe(1e6)
    expect(moneyScale(3000).unit).toBe('هزار تومان')
    expect(moneyScale(500).divisor).toBe(1)
  })
})
