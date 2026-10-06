import { describe, expect, it } from 'vitest'
import { toGregorian } from 'jalaali-js'
import {
buildPeriodComparison,
buildPeriodWindows,
compareValues,
jalaaliMonthLength,
percentAt,
physicalAt,
type ActivityHistory,
} from '@/features/manager/lib/period-comparison'

const HOUR = 3_600_000
const DAY = 86_400_000

/** Instant of a Tehran wall-clock time (fixed UTC+03:30). */
function tehran(gy: number, gm: number, gd: number, h = 0, m = 0): number {
  return Date.UTC(gy, gm - 1, gd, h, m) - 3.5 * HOUR
}

function jalali(jy: number, jm: number, jd: number, h = 0, m = 0): number {
  const g = toGregorian(jy, jm, jd)
  return tehran(g.gy, g.gm, g.gd, h, m)
}

// چهارشنبه ۸ مهر ۱۴۰۵، ساعت ۱۰:۱۰ تهران
const NOW = jalali(1405, 7, 8, 10, 10)

describe('jalaaliMonthLength', () => {
  it('handles 31, 30 and 29/30-day months', () => {
    expect(jalaaliMonthLength(1405, 1)).toBe(31)
    expect(jalaaliMonthLength(1405, 6)).toBe(31)
    expect(jalaaliMonthLength(1405, 7)).toBe(30)
    expect(jalaaliMonthLength(1403, 12)).toBe(30)
    expect(jalaaliMonthLength(1404, 12)).toBe(29)
  })
})

describe('buildPeriodWindows', () => {
  it('today compares with yesterday up to the same clock time', () => {
    const w = buildPeriodWindows('today', NOW)
    expect(w.current.start).toBe(jalali(1405, 7, 8))
    expect(w.current.cutoff).toBe(NOW)
    expect(w.previous.start).toBe(jalali(1405, 7, 7))
    expect(w.previous.cutoff).toBe(NOW - DAY)
    expect(w.current.buckets).toBe(24)
  })

  it('weeks start on Saturday and stop at the same weekday and time', () => {
    const w = buildPeriodWindows('week', NOW)
    expect(w.current.start).toBe(jalali(1405, 7, 4))
    expect(w.previous.start).toBe(jalali(1405, 6, 28))
    expect(w.previous.cutoff).toBe(jalali(1405, 7, 1, 10, 10))
  })

  it('treats Saturday itself as the first day of the week', () => {
    const w = buildPeriodWindows('week', jalali(1405, 7, 4, 9))
    expect(w.current.start).toBe(jalali(1405, 7, 4))
  })

  it('months follow the Jalali calendar and compare day n with day n', () => {
    const w = buildPeriodWindows('month', NOW)
    expect(w.current.start).toBe(jalali(1405, 7, 1))
    expect(w.current.buckets).toBe(30)
    expect(w.previous.start).toBe(jalali(1405, 6, 1))
    expect(w.previous.buckets).toBe(31)
    expect(w.previous.cutoff).toBe(jalali(1405, 6, 8, 10, 10))
  })

  it('clamps day n to the end of a shorter previous month', () => {
    const now = jalali(1405, 1, 31, 12)
    const w = buildPeriodWindows('month', now)
    expect(w.previous.start).toBe(jalali(1404, 12, 1))
    expect(w.previous.buckets).toBe(29)
    expect(w.previous.cutoff).toBe(w.previous.end)
    expect(w.previous.end).toBe(jalali(1405, 1, 1))
  })

  it('crosses the year boundary from Farvardin to Esfand', () => {
    const w = buildPeriodWindows('month', jalali(1405, 1, 10, 8))
    expect(w.previous.start).toBe(jalali(1404, 12, 1))
    expect(w.previous.cutoff).toBe(jalali(1404, 12, 10, 8))
  })
})

function activity(partial: Partial<ActivityHistory>): ActivityHistory {
  return {
    id: 'a',
    name: 'فعالیت',
    kind: 'task',
    weight: 1,
    budget: 100,
    baselineStart: '2026-09-01',
    baselineFinish: '2026-10-30',
    currentPercent: 0,
    history: [],
    ...partial,
  }
}

describe('percentAt', () => {
  const task = activity({ currentPercent: 40, history: [{ at: NOW - 2 * HOUR, percent: 30 }] })

  it('reads the last report at or before the instant', () => {
    expect(percentAt(task, NOW - HOUR, NOW)).toBe(30)
  })

  it('is the current value at now, matching the EVM cards', () => {
    expect(percentAt(task, NOW, NOW)).toBe(40)
  })

  it('treats a task before its first report as 0', () => {
    expect(percentAt(task, NOW - 3 * HOUR, NOW)).toBe(0)
  })

  it('keeps a package at its current value before its first snapshot', () => {
    const pkg = activity({ kind: 'package', currentPercent: 55, history: [{ at: NOW - HOUR, percent: 55 }] })
    expect(percentAt(pkg, NOW - DAY, NOW)).toBe(55)
  })

  it('weights physical progress like actualPercentOf', () => {
    const rows = [activity({ id: 'x', weight: 3, currentPercent: 100 }), activity({ id: 'y', weight: 1, currentPercent: 0 })]
    expect(physicalAt(rows, NOW, NOW)).toBe(75)
  })
})

describe('compareValues', () => {
  it('colors by good or bad, not by direction', () => {
    const up = compareValues({ state: 'ok', value: 5 }, { state: 'ok', value: 3 }, false, 'count')
    expect(up.verdict).toBe('worse')
    expect(up.changePercent).toBeCloseTo(66.67, 1)
  })

  it('never scores a side that is not reported', () => {
    const r = compareValues({ state: 'not_reported', reason: '' }, { state: 'ok', value: 3 }, true, 'count')
    expect(r).toEqual({ verdict: 'neutral', changePercent: null })
  })
})

describe('buildPeriodComparison', () => {
  const base = {
    projectId: 'p',
    nowMs: NOW,
    progressSource: { available: true, reason: '' },
    transits: [],
    issues: { events: [], checked: ['NCR'] },
    causes: [],
    warnings: [],
  }

  it('shows «not reported» instead of 0 when today has no progress report yet', () => {
    const task = activity({
      currentPercent: 20,
      history: [
        { at: NOW - 3 * DAY, percent: 10 },
        { at: NOW - DAY - HOUR, percent: 20 },
      ],
    })
    const result = buildPeriodComparison({ ...base, period: 'today', activities: [task] })
    const physical = result.metrics.find((m) => m.key === 'physical')!
    expect(physical.current.state).toBe('not_reported')
    expect(physical.previous).toEqual({ state: 'ok', value: 10 })
    expect(physical.verdict).toBe('neutral')
    expect(result.summary.better + result.summary.worse).toBe(
      result.metrics.filter((m) => m.verdict === 'better' || m.verdict === 'worse').length
    )
  })

  it('refuses levels from before the first recorded report', () => {
    const task = activity({ currentPercent: 50, history: [{ at: NOW - 2 * DAY, percent: 50 }] })
    const result = buildPeriodComparison({ ...base, period: 'week', activities: [task] })
    const physical = result.metrics.find((m) => m.key === 'physical')!
    expect(physical.previous.state).toBe('not_reported')
    const spi = result.metrics.find((m) => m.key === 'spi')!
    expect(spi.previous.state).toBe('not_reported')
    expect(spi.current.state).toBe('ok')
  })

  it('separates headcount that was never recorded from a real zero', () => {
    const result = buildPeriodComparison({ ...base, period: 'today', activities: [activity({})] })
    expect(result.metrics.find((m) => m.key === 'headcount')!.current.state).toBe('unavailable')
  })
})
