import { describe, expect, it } from 'vitest'
import {
  buildProjectProgressSeries,
  calculateSCurveActualProgress,
  progressForSCurveAsOf,
  resolveProjectCurveDateRange,
  type DailyReportActivity,
  type DailyProgressEntry,
} from '@/lib/supervisor/daily-report-activities'

const baseActivity = (
  partial: Partial<DailyReportActivity> & Pick<DailyReportActivity, 'id' | 'name'>
): DailyReportActivity => ({
  wbs: null,
  kind: 'schedule',
  plannedStartDate: '2026-01-01',
  plannedFinishDate: '2026-01-31',
  progressWeight: 50,
  plannedDurationDays: 30,
  ...partial,
})

describe('project S-curve series', () => {
  it('resolves range from schedule start (not report dates)', () => {
    const activities = [
      baseActivity({ id: 'a', name: 'A', plannedStartDate: '2026-06-01' }),
    ]
    const range = resolveProjectCurveDateRange(activities, '2026-09-02', '2026-01-01')
    expect(range.startDate).toBe('2026-01-01')
    expect(range.endDate).toBe('2026-09-02')
  })

  it('builds series from project start to endDate', () => {
    const activities = [
      baseActivity({
        id: 'schedule:a',
        name: 'Done',
        plannedStartDate: '2026-01-01',
        plannedFinishDate: '2026-01-31',
        progressWeight: 50,
        baselinePercentComplete: 100,
      }),
      baseActivity({
        id: 'schedule:b',
        name: 'In progress',
        plannedStartDate: '2026-02-01',
        plannedFinishDate: '2026-03-01',
        progressWeight: 50,
        baselinePercentComplete: 40,
      }),
    ]
    const series = buildProjectProgressSeries(activities, [], '2026-02-20', '2026-01-01')
    expect(series[0]?.date).toBe('2026-01-01')
    expect(series.at(-1)?.date).toBe('2026-02-20')
    // Mid-window for completed task ≈ 100 planned; second task partial
    expect(series.at(-1)!.actual).toBeGreaterThan(40)
  })

  it('ramps completed MSP tasks along schedule instead of staying 0 until finish', () => {
    const activity = baseActivity({
      id: 'schedule:done',
      name: 'Done',
      plannedStartDate: '2026-01-01',
      plannedFinishDate: '2026-01-31',
      baselinePercentComplete: 100,
      progressWeight: 100,
    })
    expect(progressForSCurveAsOf(activity, [], '2026-01-01', '2026-02-01')).toBe(0)
    expect(progressForSCurveAsOf(activity, [], '2026-01-16', '2026-02-01')).toBeGreaterThan(40)
    expect(progressForSCurveAsOf(activity, [], '2026-01-31', '2026-02-01')).toBe(100)
    // Before today: phases baseline along plan (partial MSP %)
    const partial = baseActivity({
      id: 'schedule:partial',
      name: 'Partial',
      plannedStartDate: '2026-01-01',
      plannedFinishDate: '2026-01-31',
      baselinePercentComplete: 50,
      progressWeight: 100,
    })
    expect(progressForSCurveAsOf(partial, [], '2026-01-16', '2026-02-01')).toBeGreaterThan(20)
    expect(progressForSCurveAsOf(partial, [], '2026-01-16', '2026-02-01')).toBeLessThan(50)
    expect(progressForSCurveAsOf(partial, [], '2026-02-01', '2026-02-01')).toBe(50)
  })
})
