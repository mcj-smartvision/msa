import { describe, expect, it } from 'vitest'
import { computePpc, computeTcpi, computeTcpiPpc, ragFromPpc, ragFromTcpi } from '@/features/project-controls/lib/tcpi-ppc'

describe('computeTcpi', () => {
  it('computes the ratio with substitution and catalog texts', () => {
    const r = computeTcpi({ bac: 1000, ev: 400, ac: 500 })
    expect(r.code).toBe('KPI-04')
    expect(r.value).toBe(1.2)
    expect(r.rag).toBe('CRITICAL')
    expect(r.substitution).toBe('TCPI_BAC = (1,000.00 − 400.00) ÷ (1,000.00 − 500.00) = 600.00 ÷ 500.00 = 1.200')
    expect(r.actionable_decision_fa).toContain('جلسه فوری با کارفرما')
  })

  it('applies the 1.05 / 1.15 thresholds', () => {
    expect(ragFromTcpi(1.05)).toBe('HEALTHY')
    expect(ragFromTcpi(1.0501)).toBe('WARNING')
    expect(ragFromTcpi(1.15)).toBe('WARNING')
    expect(ragFromTcpi(1.1501)).toBe('CRITICAL')
    expect(computeTcpi({ bac: 1000, ev: 400, ac: 450 }).rag).toBe('WARNING')
    expect(computeTcpi({ bac: 1000, ev: 500, ac: 500 }).rag).toBe('HEALTHY')
  })

  it('returns 0 when the work is complete', () => {
    const r = computeTcpi({ bac: 1000, ev: 1000, ac: 1200 })
    expect(r.value).toBe(0)
    expect(r.rag).toBe('HEALTHY')
  })

  it('returns null and critical when the budget is exhausted with work left', () => {
    const r = computeTcpi({ bac: 1000, ev: 800, ac: 1000 })
    expect(r.value).toBeNull()
    expect(r.rag).toBe('CRITICAL')
    expect(r.substitution).toContain('∞')
    expect(r.interpretation_fa).toContain('بودجهٔ مصوب تمام شده')
  })

  it('rejects invalid input', () => {
    expect(computeTcpi({ bac: 0, ev: 0, ac: 0 }).value).toBeNull()
    expect(computeTcpi({ bac: Number.NaN, ev: 0, ac: 0 }).rag).toBe('CRITICAL')
  })
})

describe('computePpc', () => {
  it('computes the share of completed commitments', () => {
    const r = computePpc(20, 15)
    expect(r.code).toBe('KPI-05')
    expect(r.value).toBe(75)
    expect(r.rag).toBe('WARNING')
    expect(r.substitution).toBe('PPC = (15 ÷ 20) × 100 = 75.0')
    expect(r.actionable_decision_fa).toContain('Last Planner')
  })

  it('applies the 70 / 85 thresholds', () => {
    expect(ragFromPpc(85)).toBe('HEALTHY')
    expect(ragFromPpc(84.9)).toBe('WARNING')
    expect(ragFromPpc(70)).toBe('WARNING')
    expect(ragFromPpc(69.9)).toBe('CRITICAL')
  })

  it('returns 0 with a warning when nothing was planned', () => {
    const r = computePpc(0, 3)
    expect(r.value).toBe(0)
    expect(r.rag).toBe('CRITICAL')
    expect((r.debug?.warnings as string[]).length).toBeGreaterThan(0)
  })

  it('caps the value at 100', () => {
    const r = computePpc(10, 12)
    expect(r.value).toBe(100)
    expect(r.rag).toBe('HEALTHY')
    expect(r.substitution).toContain('⇒ 100.0')
  })
})

describe('computeTcpiPpc', () => {
  it('returns both metrics', () => {
    const r = computeTcpiPpc({ bac: 1000, ev: 400, ac: 300, leanWeeklyPlanned: 10, leanWeeklyCompleted: 9 })
    expect(r.tcpi.value).toBeCloseTo(0.857, 3)
    expect(r.ppc.value).toBe(90)
  })
})
