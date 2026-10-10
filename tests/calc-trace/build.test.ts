import { describe, expect, it } from 'vitest'
import {
  cpiIsCritical,
  makeTrace,
  ppcTrace,
  progressGapTrace,
  warnBacScope,
  warnCpiLow,
  warnEacBelowAc,
  warnPpcZeroDenominator,
  warnProgressGap,
  warnUniformPv,
  type ProgressCompareInput,
} from '@/features/calc-trace/lib/build'

const base = { metric: 'm', label: 'l', unit: 'index' as const, formula: 'f', formulaHuman: 'h', inputs: [] }

describe('makeTrace status', () => {
  it('insufficient without a result, critical when flagged, warning with warnings, else ok', () => {
    expect(makeTrace({ ...base, result: null }).status).toBe('insufficient')
    expect(makeTrace({ ...base, result: 1, critical: true }).status).toBe('critical')
    expect(makeTrace({ ...base, result: 1, warnings: [null, 'x'] }).status).toBe('warning')
    expect(makeTrace({ ...base, result: 1, warnings: [null] }).status).toBe('ok')
  })
})

describe('automatic warnings', () => {
  it('BAC scope: only when BAC is WBS-only and AC carries overhead', () => {
    expect(warnBacScope({ bacIsWbsOnly: true, acOverhead: 100 })).not.toBeNull()
    expect(warnBacScope({ bacIsWbsOnly: true, acOverhead: 0 })).toBeNull()
    expect(warnBacScope({ bacIsWbsOnly: false, acOverhead: 100 })).toBeNull()
  })

  it('PPC denominator zero or missing', () => {
    expect(warnPpcZeroDenominator(0)).not.toBeNull()
    expect(warnPpcZeroDenominator(null)).not.toBeNull()
    expect(warnPpcZeroDenominator(4)).toBeNull()
  })

  it('PV: straight line or flat tail is flagged, an S-curve is not', () => {
    expect(warnUniformPv([0, 25, 50, 75, 100])).not.toBeNull()
    expect(warnUniformPv([5, 20, 40, 40, 40])).not.toBeNull()
    expect(warnUniformPv([0, 5, 20, 50, 80, 95, 100])).toBeNull()
  })

  it('progress gap above 3 points', () => {
    expect(warnProgressGap(50, 46)).not.toBeNull()
    expect(warnProgressGap(50, 48)).toBeNull()
    expect(warnProgressGap(null, 48)).toBeNull()
  })

  it('EAC below AC', () => {
    expect(warnEacBelowAc(90, 100)).not.toBeNull()
    expect(warnEacBelowAc(110, 100)).toBeNull()
  })

  it('CPI under 0.8 is critical and explains the cost per toman', () => {
    expect(cpiIsCritical(0.5)).toBe(true)
    expect(cpiIsCritical(0.8)).toBe(false)
    expect(cpiIsCritical(0)).toBe(false)
    expect(warnCpiLow(0.5)).toContain('2')
  })
})

const act = (id: string, weight: number, stored: number, supervisor: number | null): ProgressCompareInput => ({
  id,
  name: id,
  wbs: null,
  weight,
  stored,
  supervisor,
  supervisorDate: supervisor == null ? null : '2026-10-01',
  table: 'project_tasks',
})

describe('progress gap trace', () => {
  it('compares weighted averages over reported activities only', () => {
    const t = progressGapTrace('g', [act('a', 1, 60, 50), act('b', 3, 40, 40), act('c', 5, 90, null)])
    expect(t.result).toBeCloseTo((60 + 120) / 4 - (50 + 120) / 4)
    expect(t.status).toBe('ok')
  })

  it('is insufficient when nothing is reported', () => {
    expect(progressGapTrace('g', [act('a', 1, 60, null)]).status).toBe('insufficient')
  })
})

describe('PPC trace', () => {
  it('completed ÷ planned × 100', () => {
    const t = ppcTrace('p', { start: '2026-09-26', end: '2026-10-02', planned: 8, completed: 6, ppc: 75 }, 'wwp')
    expect(t.result).toBe(75)
    expect(t.status).toBe('ok')
  })

  it('zero denominator is insufficient with a warning', () => {
    const t = ppcTrace('p', { start: '2026-09-26', end: '2026-10-02', planned: 0, completed: 0, ppc: null }, 'schedule')
    expect(t.status).toBe('insufficient')
    expect(t.warnings.length).toBe(1)
  })
})
