import { describe, expect, it } from 'vitest'
import {
  CALENDAR_DAYS,
  plannedPercentInWindow,
  weightedPlannedPercent,
  type WorkCalendar,
} from '@/lib/schedule/planned-progress'

describe('CALENDAR_DAYS', () => {
  it('counts both ends', () => {
    expect(CALENDAR_DAYS.countDays('2026-03-01', '2026-03-10')).toBe(10)
    expect(CALENDAR_DAYS.countDays('2026-03-01', '2026-03-01')).toBe(1)
    expect(CALENDAR_DAYS.countDays('2026-03-10', '2026-03-01')).toBe(0)
  })
})

describe('plannedPercentInWindow', () => {
  const w = { start: '2026-03-01', finish: '2026-03-10' }

  it('is 0 before the start and 100 on or after the finish', () => {
    expect(plannedPercentInWindow(w, '2026-02-28')).toBe(0)
    expect(plannedPercentInWindow(w, '2026-03-10')).toBe(100)
    expect(plannedPercentInWindow(w, '2026-04-01')).toBe(100)
  })

  it('counts the start day and does not round', () => {
    expect(plannedPercentInWindow(w, '2026-03-01')).toBe(10)
    expect(plannedPercentInWindow(w, '2026-03-05')).toBe(50)
    expect(plannedPercentInWindow({ start: '2026-03-01', finish: '2026-03-03' }, '2026-03-01')).toBeCloseTo(
      100 / 3,
      10
    )
  })

  it('treats a missing finish as a one-day window and a missing start as no plan', () => {
    expect(plannedPercentInWindow({ start: '2026-03-01', finish: null }, '2026-03-01')).toBe(100)
    expect(plannedPercentInWindow({ start: null, finish: '2026-03-10' }, '2026-03-05')).toBe(0)
  })

  it('reads timestamps on the Tehran calendar', () => {
    // 22:00 UTC on Feb 28 is already Mar 1 in Tehran.
    expect(plannedPercentInWindow({ start: '2026-02-28T22:00:00Z', finish: '2026-03-10' }, '2026-03-01')).toBe(10)
  })

  it('uses the calendar it is given', () => {
    const everyOtherDay: WorkCalendar = {
      id: 'test',
      countDays: (a, b) => Math.ceil(CALENDAR_DAYS.countDays(a, b) / 2),
    }
    expect(plannedPercentInWindow(w, '2026-03-05', everyOtherDay)).toBe(60)
  })
})

describe('weightedPlannedPercent', () => {
  it('weights rows and ignores non-positive weights', () => {
    const rows = [
      { start: '2026-03-01', finish: '2026-03-10', weight: 3 },
      { start: '2026-01-01', finish: '2026-01-31', weight: 1 },
      { start: '2026-03-01', finish: '2026-03-10', weight: 0 },
    ]
    expect(weightedPlannedPercent(rows, '2026-03-05')).toBe((3 * 50 + 100) / 4)
  })

  it('is null without positive weight', () => {
    expect(weightedPlannedPercent([{ start: '2026-03-01', finish: '2026-03-10', weight: 0 }], '2026-03-05')).toBeNull()
  })
})
