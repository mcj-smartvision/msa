import { describe, expect, it } from 'vitest'
import {
activitiesEligibleForDailyReport,
partitionEligibleByTiming,
type DailyProgressEntry,
type DailyReportActivity,
} from '@/features/supervisor/lib/daily-report-activities'

const base = (
  partial: Partial<DailyReportActivity> & Pick<DailyReportActivity, 'id' | 'name'>
): DailyReportActivity => ({
  wbs: '1.1',
  kind: 'schedule',
  plannedStartDate: '2026-08-01',
  plannedFinishDate: '2026-08-31',
  progressWeight: 10,
  plannedDurationDays: 30,
  baselinePercentComplete: 0,
  ...partial,
})

describe('daily report eligibility', () => {
  const today = '2026-09-03'

  it('shows current-window activities even when MSP baseline is 100%', () => {
    const activities = [
      base({
        id: 'schedule:current',
        name: 'Current',
        plannedStartDate: '2026-08-24',
        plannedFinishDate: '2026-09-21',
        baselinePercentComplete: 100,
      }),
    ]
    const eligible = activitiesEligibleForDailyReport(activities, [], today)
    expect(eligible.map((a) => a.id)).toEqual(['schedule:current'])
    const parts = partitionEligibleByTiming(activities, [], today)
    expect(parts.current).toHaveLength(1)
    expect(parts.past).toHaveLength(0)
    expect(parts.upcoming).toHaveLength(0)
  })

  it('hides future activities whose start has not arrived', () => {
    const activities = [
      base({
        id: 'schedule:future',
        name: 'Future',
        plannedStartDate: '2026-09-11',
        plannedFinishDate: '2026-09-20',
        baselinePercentComplete: 0,
      }),
    ]
    expect(activitiesEligibleForDailyReport(activities, [], today)).toEqual([])
  })

  it('unlocks the next activity early when the prior wave is 100% complete', () => {
    const activities = [
      base({
        id: 'schedule:prior',
        name: 'Prior',
        wbs: '1.1',
        plannedStartDate: '2026-08-20',
        plannedFinishDate: '2026-09-10',
        baselinePercentComplete: 0,
      }),
      base({
        id: 'schedule:next',
        name: 'Next',
        wbs: '1.2',
        plannedStartDate: '2026-09-11',
        plannedFinishDate: '2026-09-25',
        baselinePercentComplete: 0,
      }),
    ]
    const entries: DailyProgressEntry[] = [
      {
        activityId: 'schedule:prior',
        reportDate: today,
        percentComplete: 100,
      },
    ]
    const eligible = activitiesEligibleForDailyReport(activities, entries, today)
    expect(eligible.map((a) => a.id)).toEqual(['schedule:next'])
    const parts = partitionEligibleByTiming(activities, entries, today)
    expect(parts.current.map((a) => a.id)).toEqual(['schedule:next'])
  })

  it('keeps the next activity hidden while the prior wave is still incomplete', () => {
    const activities = [
      base({
        id: 'schedule:prior-a',
        name: 'Prior A',
        wbs: '1.1',
        plannedStartDate: '2026-08-20',
        plannedFinishDate: '2026-09-10',
        baselinePercentComplete: 100,
      }),
      base({
        id: 'schedule:prior-b',
        name: 'Prior B',
        wbs: '1.2',
        plannedStartDate: '2026-08-20',
        plannedFinishDate: '2026-09-10',
        baselinePercentComplete: 40,
      }),
      base({
        id: 'schedule:next',
        name: 'Next',
        wbs: '1.3',
        plannedStartDate: '2026-09-11',
        plannedFinishDate: '2026-09-25',
        baselinePercentComplete: 0,
      }),
    ]
    expect(activitiesEligibleForDailyReport(activities, [], today).map((a) => a.id)).toEqual([
      'schedule:prior-a',
      'schedule:prior-b',
    ])
  })

  it('skips already-complete future work and unlocks the next incomplete activity', () => {
    const activities = [
      base({
        id: 'schedule:prior',
        name: 'Prior',
        wbs: '1.1',
        plannedStartDate: '2026-08-01',
        plannedFinishDate: '2026-08-20',
        baselinePercentComplete: 100,
      }),
      base({
        id: 'schedule:next-done',
        name: 'Next done',
        wbs: '1.2',
        plannedStartDate: '2026-09-11',
        plannedFinishDate: '2026-09-20',
        baselinePercentComplete: 100,
      }),
      base({
        id: 'schedule:next-open',
        name: 'Next open',
        wbs: '1.3',
        plannedStartDate: '2026-09-21',
        plannedFinishDate: '2026-09-30',
        baselinePercentComplete: 0,
      }),
    ]
    expect(activitiesEligibleForDailyReport(activities, [], today).map((a) => a.id)).toEqual([
      'schedule:next-open',
    ])
  })

  it('never shows past-finish activities that are already 100%', () => {
    const activities = [
      base({
        id: 'schedule:past-done',
        name: 'Past done',
        plannedStartDate: '2026-06-01',
        plannedFinishDate: '2026-06-30',
        baselinePercentComplete: 100,
      }),
      base({
        id: 'schedule:past-reported',
        name: 'Past reported',
        plannedStartDate: '2026-07-01',
        plannedFinishDate: '2026-07-31',
        baselinePercentComplete: 40,
      }),
    ]
    const entries: DailyProgressEntry[] = [
      {
        activityId: 'schedule:past-reported',
        reportDate: '2026-08-15',
        percentComplete: 100,
      },
    ]
    expect(activitiesEligibleForDailyReport(activities, entries, today)).toEqual([])
  })

  it('shows past incomplete activities and hides MSP-complete past work', () => {
    const activities = [
      base({
        id: 'schedule:past-open',
        name: 'Past open',
        plannedStartDate: '2026-07-01',
        plannedFinishDate: '2026-07-31',
        baselinePercentComplete: 40,
      }),
      base({
        id: 'schedule:past-done',
        name: 'Past done',
        plannedStartDate: '2026-06-01',
        plannedFinishDate: '2026-06-30',
        baselinePercentComplete: 100,
      }),
    ]
    const eligible = activitiesEligibleForDailyReport(activities, [], today)
    expect(eligible.map((a) => a.id)).toEqual(['schedule:past-open'])
    const parts = partitionEligibleByTiming(activities, [], today)
    expect(parts.past.map((a) => a.id)).toEqual(['schedule:past-open'])
  })

  it('hides current activities after workshop reports 100%', () => {
    const activities = [
      base({
        id: 'schedule:current',
        name: 'Current',
        plannedStartDate: '2026-08-24',
        plannedFinishDate: '2026-09-21',
        baselinePercentComplete: 50,
      }),
    ]
    const entries: DailyProgressEntry[] = [
      {
        activityId: 'schedule:current',
        reportDate: today,
        percentComplete: 100,
      },
    ]
    expect(activitiesEligibleForDailyReport(activities, entries, today)).toEqual([])
  })
})
