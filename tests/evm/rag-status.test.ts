import { describe, expect, it } from 'vitest'
import { evaluateRagStatus, summarizeFloatHealth } from '@/lib/evm/ragStatus'

const base = { spi: 1, cpi: 1, criticalFloatDays: 5, floatConsumptionPercent: 10 }

describe('evaluateRagStatus', () => {
  it('is GREEN when both indices are ≥ 0.95 and float is non-negative', () => {
    const r = evaluateRagStatus({ ...base, spi: 0.95, cpi: 0.95, criticalFloatDays: 0 })
    expect(r.status).toBe('GREEN')
    expect(r.reasons).toHaveLength(0)
    expect(r.evaluated).toBe(true)
  })

  it('is AMBER for an index between 0.85 and 0.95', () => {
    expect(evaluateRagStatus({ ...base, spi: 0.9 }).status).toBe('AMBER')
    expect(evaluateRagStatus({ ...base, cpi: 0.85 }).status).toBe('AMBER')
  })

  it('is AMBER when float consumption exceeds 75%', () => {
    expect(evaluateRagStatus({ ...base, floatConsumptionPercent: 76 }).status).toBe('AMBER')
    expect(evaluateRagStatus({ ...base, floatConsumptionPercent: 75 }).status).toBe('GREEN')
  })

  it('is RED for an index below 0.85 or negative critical float', () => {
    expect(evaluateRagStatus({ ...base, spi: 0.84 }).status).toBe('RED')
    expect(evaluateRagStatus({ ...base, cpi: 0.5 }).status).toBe('RED')
    expect(evaluateRagStatus({ ...base, criticalFloatDays: -1 }).status).toBe('RED')
  })

  it('RED wins over AMBER and lists every reason', () => {
    const r = evaluateRagStatus({ spi: 0.9, cpi: 0.7, criticalFloatDays: -2, floatConsumptionPercent: 90 })
    expect(r.status).toBe('RED')
    expect(r.reasons.map((x) => x.code).sort()).toEqual(
      ['CPI_CRITICAL', 'FLOAT_CONSUMPTION', 'NEGATIVE_CRITICAL_FLOAT', 'SPI_WARNING'].sort()
    )
  })

  it('skips missing indices and flags when nothing can be evaluated', () => {
    expect(evaluateRagStatus({ ...base, cpi: null }).status).toBe('GREEN')
    const empty = evaluateRagStatus({
      spi: null,
      cpi: null,
      criticalFloatDays: null,
      floatConsumptionPercent: null,
    })
    expect(empty.evaluated).toBe(false)
  })
})

describe('summarizeFloatHealth', () => {
  it('uses the lowest float among critical tasks', () => {
    const r = summarizeFloatHealth(
      [
        { taskId: 'a', totalFloat: 3, isCritical: true },
        { taskId: 'b', totalFloat: -2, isCritical: true },
        { taskId: 'c', totalFloat: -10, isCritical: false },
      ],
      new Map()
    )
    expect(r.criticalFloatDays).toBe(-2)
    expect(r.criticalTaskId).toBe('b')
    expect(r.criticalFromAllTasks).toBe(false)
    expect(r.floatConsumptionPercent).toBeNull()
  })

  it('falls back to all tasks when none is critical', () => {
    const r = summarizeFloatHealth(
      [
        { taskId: 'a', totalFloat: 4, isCritical: false },
        { taskId: 'b', totalFloat: 2, isCritical: false },
      ],
      new Map()
    )
    expect(r.criticalFloatDays).toBe(2)
    expect(r.criticalFromAllTasks).toBe(true)
  })

  it('reports the worst float consumption vs the first sample', () => {
    const r = summarizeFloatHealth(
      [
        { taskId: 'a', totalFloat: 2, isCritical: false },
        { taskId: 'b', totalFloat: 9, isCritical: false },
      ],
      new Map([
        ['a', 10],
        ['b', 10],
        ['c', 0],
      ])
    )
    expect(r.floatConsumptionPercent).toBeCloseTo(80)
    expect(r.worstConsumptionTaskId).toBe('a')
    expect(r.worstInitialFloat).toBe(10)
    expect(r.worstCurrentFloat).toBe(2)
  })

  it('returns nulls without CPM data', () => {
    expect(summarizeFloatHealth([], new Map()).criticalFloatDays).toBeNull()
  })
})
