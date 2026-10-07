import { describe, expect, it } from 'vitest'
import { compressWindows, groupWindows, windowOn, windowSegments } from '@/features/schedule/lib/week-commitment-windows'
import { forecastShift, segmentedPlannedProgress } from '@/features/supervisor/lib/progress-ledger'

const windows = groupWindows([
  { from: '2026-10-10', activityId: 'a', start: '2026-10-05', finish: '2026-10-14' },
  { from: '2026-10-03', activityId: 'a', start: '2026-10-03', finish: '2026-10-12' },
])
const approved = { start: '2026-10-01', finish: '2026-10-10' }

describe('windowOn', () => {
  it('uses the latest change on or before the date, else the approved plan', () => {
    expect(windowOn(windows, 'a', '2026-09-26', approved)).toEqual(approved)
    expect(windowOn(windows, 'a', '2026-10-04', approved)).toEqual({ start: '2026-10-03', finish: '2026-10-12' })
    expect(windowOn(windows, 'a', '2026-10-24', approved)).toEqual({ start: '2026-10-05', finish: '2026-10-14' })
    expect(windowOn(windows, 'other', '2026-10-24', approved)).toEqual(approved)
  })
})

describe('compressWindows', () => {
  it('keeps only the days a window changes', () => {
    const day = (from: string, start: string) => ({ from, activityId: 'a', start, finish: '2026-10-20' })
    const out = compressWindows([day('2026-10-01', '2026-10-05'), day('2026-10-02', '2026-10-05'), day('2026-10-03', '2026-10-07')])
    expect(out.map((r) => r.from)).toEqual(['2026-10-01', '2026-10-03'])
  })
})

describe('segmentedPlannedProgress', () => {
  it('switches the required curve at each change', () => {
    const planned = segmentedPlannedProgress(windowSegments(windows, 'a', approved))
    // Before 10-03 the approved plan (01..10, 8 workdays): 10-01 is its first day.
    expect(planned.get('2026-10-01')?.cumulative).toBe(12.5)
    // From 10-03 the window 03..12 (9 workdays): 10-03 is its first day.
    expect(planned.get('2026-10-03')?.cumulative).toBe(11.11)
    // From 10-10 the window 05..14 (9 workdays): 10-10 is its 5th workday.
    expect(planned.get('2026-10-10')?.cumulative).toBe(55.56)
    expect(planned.get('2026-10-14')?.cumulative).toBe(100)
  })
})

describe('forecastShift', () => {
  const row = (startDate: string, finishDate: string) => ({
    startDate,
    finishDate,
    approvedStartDate: '2026-10-10',
    approvedFinishDate: '2026-10-20',
  })
  it('reports the start shift before the activity starts and the finish shift after', () => {
    expect(forecastShift(row('2026-10-12', '2026-10-22'), '2026-10-07')).toEqual({ days: 2, of: 'start' })
    expect(forecastShift(row('2026-10-10', '2026-10-18'), '2026-10-12')).toEqual({ days: -2, of: 'finish' })
    expect(forecastShift(row('2026-10-10', '2026-10-20'), '2026-10-12')).toBeNull()
  })
})
