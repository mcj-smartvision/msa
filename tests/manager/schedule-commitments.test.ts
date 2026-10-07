import { describe, expect, it } from 'vitest'
import { buildScheduleCommitments, type CommitmentActivity } from '@/features/manager/lib/schedule-commitments'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'

// 2026-10-03 is a Saturday; the site week runs to Thursday 2026-10-08.
const act = (id: string, start: string, finish: string, baselinePercent = 0): CommitmentActivity => ({
  id,
  name: id,
  wbs: null,
  start,
  finish,
  baselinePercent,
})
const report = (activityId: string, reportDate: string, percentComplete: number): DailyProgressEntry => ({
  activityId,
  reportDate,
  percentComplete,
})

describe('buildScheduleCommitments', () => {
  it('commits every activity planned in the week and scores those at or above Thursday’s plan', () => {
    const data = buildScheduleCommitments({
      // a: 10 days from 2026-09-29, Thursday is day 10 → 100 %. b: 20 days → 50 % by Thursday.
      activities: [
        act('a', '2026-09-29', '2026-10-08'),
        act('b', '2026-09-29', '2026-10-18'),
        act('c', '2026-10-01', '2026-10-05'),
        act('later', '2026-10-10', '2026-10-20'),
      ],
      entries: [report('a', '2026-10-08', 100), report('b', '2026-10-07', 49), report('c', '2026-10-05', 100)],
      today: '2026-10-09',
    })!
    const week = data.current!
    expect(week).toMatchObject({ start: '2026-10-03', end: '2026-10-08', planned: 3, completed: 2, live: false })
    const b = week.commitments.find((c) => c.description === 'b')!
    expect(b).toMatchObject({ completed: false, targetPercent: 50, actualPercent: 49 })
    expect(week.commitments[0]!.description).toBe('b')
  })

  it('scores the running week with progress up to today and ignores reports after a closed Thursday', () => {
    const activities = [act('a', '2026-09-26', '2026-10-08')]
    const live = buildScheduleCommitments({ activities, entries: [report('a', '2026-10-06', 100)], today: '2026-10-07' })!
    expect(live.current).toMatchObject({ live: true, completed: 1 })

    const late = buildScheduleCommitments({ activities, entries: [report('a', '2026-10-09', 100)], today: '2026-10-10' })!
    const closedWeek = late.weeks.find((w) => w.start === '2026-10-03')!
    expect(closedWeek).toMatchObject({ completed: 0, planned: 1 })
  })

  it('uses the stored schedule percent only for a never-reported activity', () => {
    const data = buildScheduleCommitments({
      activities: [act('imported', '2026-10-03', '2026-10-05', 100), act('silent', '2026-10-03', '2026-10-05')],
      entries: [],
      today: '2026-10-09',
    })!
    expect(data.current).toMatchObject({ planned: 2, completed: 1 })
    expect(data.source).toBe('schedule')
  })

  it('scores each week against the forecast window as of its Thursday', () => {
    // Approved plan: a ends 2026-10-08 (100 % by Thursday). From 2026-10-05 the forecast moves it later.
    const windows = groupWindows([
      { from: '2026-10-05', activityId: 'a', start: '2026-10-01', finish: '2026-10-12' },
    ])
    const data = buildScheduleCommitments({
      activities: [act('a', '2026-09-29', '2026-10-08')],
      entries: [report('a', '2026-10-08', 70)],
      today: '2026-10-09',
      windows,
    })!
    // 2026-10-01..10-12 is 12 days; Thursday 10-08 is day 8 → 66.67 %; 70 % scores.
    expect(data.current!.commitments[0]).toMatchObject({ targetPercent: 66.67, completed: true })
    // The week before the forecast moved it still uses the approved plan.
    const prior = data.weeks.find((w) => w.start === '2026-09-26')!
    expect(prior.planned).toBe(1)
  })

  it('returns null without any dated activity', () => {
    expect(buildScheduleCommitments({ activities: [act('x', '', '')], entries: [], today: '2026-10-09' })).toBeNull()
  })
})
