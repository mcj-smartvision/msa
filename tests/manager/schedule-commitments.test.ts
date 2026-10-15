import { describe, expect, it } from 'vitest'
import { buildScheduleCommitments, rncKey, type CommitmentActivity } from '@/features/manager/lib/schedule-commitments'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'

// 2026-10-03 is a Saturday; the site week runs to Thursday 2026-10-08 (Friday off).
// Evaluation opens Thursday 16:00 Tehran = 12:30 UTC.
const BEFORE_EVALUATION = Date.parse('2026-10-07T08:00:00Z')
const AFTER_EVALUATION = Date.parse('2026-10-09T08:00:00Z')

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
  it('commits each activity’s share of the week and scores 1 only when the week’s gain reaches it', () => {
    const data = buildScheduleCommitments({
      activities: [
        // 9 working days; 3 before Saturday → share 100 − 33.33 = 66.67.
        act('a', '2026-09-29', '2026-10-08'),
        // 17 working days; 3 before Saturday, 9 by Thursday → share 52.94 − 17.65 = 35.29.
        act('b', '2026-09-29', '2026-10-18'),
        // 4 working days; 1 before Saturday → share 75.
        act('c', '2026-10-01', '2026-10-05'),
        act('later', '2026-10-10', '2026-10-20'),
      ],
      entries: [report('a', '2026-10-08', 100), report('b', '2026-10-07', 30), report('c', '2026-10-05', 100)],
      today: '2026-10-09',
      nowMs: AFTER_EVALUATION,
    })!
    const week = data.current!
    expect(week).toMatchObject({ start: '2026-10-03', end: '2026-10-08', planned: 3, completed: 2, live: false })
    const b = week.commitments.find((c) => c.description === 'b')!
    expect(b).toMatchObject({ activityId: 'b', completed: false, targetPercent: 35.29, actualPercent: 30 })
    expect(week.commitments[0]!.description).toBe('b')
    expect(week.commitments.find((c) => c.description === 'a')).toMatchObject({ targetPercent: 66.67, actualPercent: 100 })
  })

  it('measures the gain from the cumulative before Saturday', () => {
    const data = buildScheduleCommitments({
      activities: [act('b', '2026-09-29', '2026-10-18')],
      // 20 before the week, 50 by Thursday: gain 30 < share 35.29.
      entries: [report('b', '2026-10-01', 20), report('b', '2026-10-07', 50)],
      today: '2026-10-09',
      nowMs: AFTER_EVALUATION,
    })!
    expect(data.current!.commitments[0]).toMatchObject({ completed: false, actualPercent: 30 })
  })

  it('is provisional before Thursday 16:00 and ignores reports after Thursday', () => {
    // 12 working days, 6 before Saturday → share 50.
    const activities = [act('a', '2026-09-26', '2026-10-08')]
    const live = buildScheduleCommitments({
      activities,
      entries: [report('a', '2026-10-06', 100)],
      today: '2026-10-07',
      nowMs: BEFORE_EVALUATION,
    })!
    expect(live.current).toMatchObject({ live: true, completed: 1 })

    const late = buildScheduleCommitments({
      activities,
      entries: [report('a', '2026-10-09', 100)],
      today: '2026-10-10',
      nowMs: Date.parse('2026-10-10T08:00:00Z'),
    })!
    const closedWeek = late.weeks.find((w) => w.start === '2026-10-03')!
    expect(closedWeek).toMatchObject({ completed: 0, planned: 1, live: false })
  })

  it('does not commit an activity the stored schedule percent already completes', () => {
    const data = buildScheduleCommitments({
      activities: [act('imported', '2026-10-03', '2026-10-05', 100), act('silent', '2026-10-03', '2026-10-05')],
      entries: [],
      today: '2026-10-09',
      nowMs: AFTER_EVALUATION,
    })!
    expect(data.current).toMatchObject({ planned: 1, completed: 0 })
    expect(data.current!.commitments.map((c) => c.description)).toEqual(['silent'])
    expect(data.source).toBe('schedule')
  })

  it('uses the forecast window frozen on Saturday morning', () => {
    const windows = groupWindows([
      // In force on Saturday: 10 working days, 1 before Saturday, 7 by Thursday → share 60.
      { from: '2026-10-03', activityId: 'a', start: '2026-10-01', finish: '2026-10-12' },
      // Changed mid-week: applies from next week only.
      { from: '2026-10-05', activityId: 'a', start: '2026-10-01', finish: '2026-10-30' },
    ])
    const data = buildScheduleCommitments({
      activities: [act('a', '2026-09-29', '2026-10-08')],
      entries: [report('a', '2026-10-08', 60)],
      today: '2026-10-09',
      nowMs: AFTER_EVALUATION,
      windows,
    })!
    expect(data.current!.commitments[0]).toMatchObject({ targetPercent: 60, completed: true })
    // The week before the forecast still uses the approved plan.
    expect(data.weeks.find((w) => w.start === '2026-09-26')!.planned).toBe(1)
  })

  it('aggregates recorded reasons of missed commitments', () => {
    const data = buildScheduleCommitments({
      activities: [act('b', '2026-09-29', '2026-10-18')],
      entries: [report('b', '2026-10-07', 10)],
      today: '2026-10-09',
      nowMs: AFTER_EVALUATION,
      rnc: new Map([[rncKey('b', '2026-10-03'), { category: 'materials', note: 'میلگرد نرسید' }]]),
    })!
    expect(data.current!.commitments[0]).toMatchObject({ rootCause: 'materials', rootCauseNote: 'میلگرد نرسید' })
    expect(data.rnc.causes[0]).toMatchObject({ key: 'materials', count: 1 })
  })

  it('returns null without any dated activity', () => {
    expect(buildScheduleCommitments({ activities: [act('x', '', '')], entries: [], today: '2026-10-09' })).toBeNull()
  })
})
