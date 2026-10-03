import { describe, expect, it } from 'vitest'
import {
  computeEarnedSchedule,
  EarnedScheduleDomainError,
  ragFromSpiT,
  solveEarnedSchedule,
} from '@/lib/project-controls/earned-schedule'
import { buildBaselinePVCurve } from '@/lib/project-controls/pv-curve'
import type { PVCurvePoint } from '@/types/project-controls'

const curve: PVCurvePoint[] = [
  { periodIndex: 0, cumulativePV: 0 },
  { periodIndex: 1, cumulativePV: 100 },
  { periodIndex: 2, cumulativePV: 300 },
  { periodIndex: 3, cumulativePV: 600 },
  { periodIndex: 4, cumulativePV: 1000 },
]

describe('solveEarnedSchedule', () => {
  it('interpolates inside the bracketing period', () => {
    const sol = solveEarnedSchedule(curve, 450, 4)
    expect(sol.c?.periodIndex).toBe(2)
    expect(sol.fraction).toBeCloseTo(0.5, 10)
    expect(sol.es).toBeCloseTo(2.5, 10)
  })

  it('handles the edges', () => {
    expect(solveEarnedSchedule(curve, 0, 4).es).toBe(0)
    expect(solveEarnedSchedule(curve, -5, 4).es).toBe(0)
    expect(solveEarnedSchedule(curve, 1000, 4).es).toBe(4)
    expect(solveEarnedSchedule(curve, 1200, 4).es).toBe(4)
    expect(solveEarnedSchedule(curve, 300, 4).es).toBe(2)
  })

  it('takes the end of a flat stretch and sorts unsorted input', () => {
    const flat = [
      { periodIndex: 3, cumulativePV: 100 },
      { periodIndex: 0, cumulativePV: 0 },
      { periodIndex: 1, cumulativePV: 50 },
      { periodIndex: 2, cumulativePV: 50 },
    ]
    expect(solveEarnedSchedule(flat, 50, 3).es).toBe(2)
    expect(solveEarnedSchedule(flat, 75, 3).es).toBeCloseTo(2.5, 10)
  })

  it('rejects an empty or decreasing curve', () => {
    expect(() => solveEarnedSchedule([], 10, 4)).toThrow(EarnedScheduleDomainError)
    expect(() =>
      solveEarnedSchedule(
        [
          { periodIndex: 0, cumulativePV: 10 },
          { periodIndex: 1, cumulativePV: 5 },
        ],
        3,
        1
      )
    ).toThrow(/نزولی/)
  })
})

describe('computeEarnedSchedule', () => {
  const base = {
    projectStartDate: '2026-01-01',
    currentEV: 450,
    baselinePVCurve: curve,
    plannedDurationPeriods: 4,
    periodUnit: 'days' as const,
  }

  it('computes every metric with formula and substitution', () => {
    const r = computeEarnedSchedule({ ...base, statusDate: '2026-01-04' }, { now: new Date('2026-01-04T08:00:00Z') })
    const m = r.metrics
    expect(m.at.value).toBe(3)
    expect(m.es.value).toBe(2.5)
    expect(m.spi_t.value).toBe(0.833)
    expect(m.sv_t.value).toBe(-0.5)
    expect(m.eac_t.value).toBe(4.8)
    expect(m.delay_forecast.value).toBe(1)
    expect(m.spi_t.substitution).toBe('SPI(t) = 2.50 ÷ 3.00 = 0.833')
    expect(m.es.substitution).toContain('I = (450.00 − 300.00) ÷ (600.00 − 300.00) = 0.5000')
    expect(r.overallRag).toBe('CRITICAL')
    expect(r.ragTokens).toEqual({ bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' })
    expect(r.computedAt).toBe('2026-01-04T08:00:00.000Z')
    for (const metric of Object.values(m)) {
      expect(metric.formula).toBeTruthy()
      expect(metric.interpretation_fa).toBeTruthy()
    }
  })

  it('uses 30.44-day months by default and reports early finish as negative delay', () => {
    const r = computeEarnedSchedule({
      ...base,
      periodUnit: undefined,
      projectStartDate: '2026-01-01',
      statusDate: '2026-03-02',
      currentEV: 600,
    })
    expect(r.metrics.at.unit).toBe('ماه')
    expect(r.metrics.at.value).toBeCloseTo(60 / 30.44, 2)
    expect(r.metrics.spi_t.value!).toBeGreaterThan(1)
    expect(r.metrics.delay_forecast.value!).toBeLessThan(0)
    expect(r.overallRag).toBe('HEALTHY')
    expect(r.metrics.at.assumptions).toContain('هر ماه = 30.44 روز تقویمی')
  })

  it('raises a domain error when AT is not positive', () => {
    expect(() => computeEarnedSchedule({ ...base, statusDate: '2026-01-01' })).toThrow(EarnedScheduleDomainError)
    expect(() => computeEarnedSchedule({ ...base, statusDate: '2025-12-01' })).toThrow(/AT/)
  })

  it('flags EAC(t) as undefined when nothing is earned', () => {
    const r = computeEarnedSchedule({ ...base, statusDate: '2026-01-04', currentEV: 0 })
    expect(r.metrics.spi_t.value).toBeNull()
    expect(r.metrics.eac_t.value).toBeNull()
    expect(r.metrics.delay_forecast.value).toBeNull()
    expect(r.overallRag).toBe('CRITICAL')
  })
})

describe('ragFromSpiT', () => {
  it('uses the 0.90 / 0.98 thresholds', () => {
    expect(ragFromSpiT(0.899)).toBe('CRITICAL')
    expect(ragFromSpiT(0.9)).toBe('WARNING')
    expect(ragFromSpiT(0.979)).toBe('WARNING')
    expect(ragFromSpiT(0.98)).toBe('HEALTHY')
    expect(ragFromSpiT(null)).toBe('CRITICAL')
  })
})

describe('buildBaselinePVCurve', () => {
  it('spreads budget over baseline days and ends at (PD, BAC)', () => {
    const c = buildBaselinePVCurve(
      [
        { weight: 100, baselineStart: '2026-01-01', baselineFinish: '2026-01-10' },
        { weight: 50, baselineStart: '2026-01-06', baselineFinish: '2026-01-10' },
        { weight: 10, baselineStart: null, baselineFinish: null },
      ],
      1
    )!
    expect(c.projectStartDate).toBe('2026-01-01')
    expect(c.plannedDurationPeriods).toBe(10)
    expect(c.skipped).toBe(1)
    expect(c.points[0]).toMatchObject({ periodIndex: 0, cumulativePV: 0 })
    expect(c.points[1]!.cumulativePV).toBeCloseTo(10, 10)
    expect(c.points[5]!.cumulativePV).toBeCloseTo(50, 10)
    expect(c.points[6]!.cumulativePV).toBeCloseTo(60 + 10, 10)
    expect(c.points.at(-1)).toMatchObject({ periodIndex: 10, cumulativePV: 150 })
  })

  it('is consistent with the engine: on-plan EV gives SPI(t) = 1', () => {
    const c = buildBaselinePVCurve([{ weight: 100, baselineStart: '2026-01-01', baselineFinish: '2026-01-10' }], 1)!
    const r = computeEarnedSchedule({
      projectStartDate: c.projectStartDate,
      statusDate: '2026-01-05',
      currentEV: 40,
      baselinePVCurve: c.points,
      plannedDurationPeriods: c.plannedDurationPeriods,
      periodUnit: 'days',
    })
    expect(r.metrics.spi_t.value).toBe(1)
    expect(r.metrics.delay_forecast.value).toBe(0)
  })
})
