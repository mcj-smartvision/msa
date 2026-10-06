import { describe, expect, it } from 'vitest'
import {
  buildActivityProgressTimeline,
  buildActivityWeekProgress,
  calendarDays,
  cumulativeBefore,
  cumulativeEntry,
  reportedDays,
  historyFromServer,
  latestReport,
  mergeProgressHistory,
  siteWeekStart,
  withLatestReports,
  withoutDay,
} from '@/lib/supervisor/weekly-activity-progress'
import type { DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'

const e = (reportDate: string, percentComplete: number, activityId = 'a1'): DailyProgressEntry => ({ activityId, reportDate, percentComplete })

describe('site week', () => {
  it('starts on Saturday', () => {
    expect(siteWeekStart('2026-10-03')).toBe('2026-10-03')
    expect(siteWeekStart('2026-10-08')).toBe('2026-10-03')
    expect(siteWeekStart('2026-10-09')).toBe('2026-10-03')
  })
})

describe('buildActivityWeekProgress', () => {
  const entries = [e('2026-09-30', 10), e('2026-10-03', 15), e('2026-10-05', 22), e('2026-10-08', 30), e('2026-10-05', 99, 'other')]

  it('each point is the progress gained that day, starting from last week cumulative', () => {
    const week = buildActivityWeekProgress('a1', entries, '2026-10-05')
    expect(week.weekStart).toBe('2026-10-03')
    expect(week.weekEnd).toBe('2026-10-08')
    expect(week.days.map((d) => d.daily)).toEqual([5, null, 7, null, null, null])
    expect(week.days.map((d) => d.cumulative)).toEqual([15, 15, 22, null, null, null])
    expect(week.days.map((d) => d.future)).toEqual([false, false, false, true, true, true])
    expect(week.endCumulative).toBe(22)
    expect(week.weekComplete).toBe(false)
  })

  it('closes the week with Thursday cumulative', () => {
    const week = buildActivityWeekProgress('a1', entries, '2026-10-08')
    expect(week.days).toHaveLength(6)
    expect(week.days[5]).toMatchObject({ label: 'پنجشنبه', daily: 8, cumulative: 30 })
    expect(week.endCumulative).toBe(30)
    expect(week.weekComplete).toBe(true)
  })

  it('a first report with its daily increment starts from cumulative − increment', () => {
    const week = buildActivityWeekProgress('a1', [{ ...e('2026-10-04', 12), dailyIncrement: 8 }], '2026-10-04', 12)
    expect(week.days[0]).toMatchObject({ daily: null, cumulative: 4 })
    expect(week.days[1]).toMatchObject({ daily: 8, cumulative: 12 })
  })

  it('uses the schedule percent only for a never-reported activity', () => {
    expect(cumulativeBefore('a1', [], '2026-10-05', 40)).toBe(40)
    expect(cumulativeBefore('a1', [e('2026-10-05', 50)], '2026-10-05', 50)).toBe(0)
    expect(cumulativeBefore('a1', [e('2026-10-04', 45), e('2026-10-05', 50)], '2026-10-05', 50)).toBe(45)
  })
})

describe('progress history sources', () => {
  it('server rows: latest saved row of each task and day, prefixed like the panel ids', () => {
    const history = historyFromServer(
      [
        { task_id: 't1', progress_date: '2026-10-04', percent_complete: 75, created_at: '2026-10-04T05:00:00Z' },
        { task_id: 't1', progress_date: '2026-10-04', percent_complete: 95, created_at: '2026-10-04T09:00:00Z' },
        { task_id: 't1', progress_date: '2026-10-04', percent_complete: 80, created_at: '2026-10-04T07:00:00Z' },
      ],
      [{ package_id: 'p1', progress_date: '2026-10-04', percent_complete: '30', created_at: null }]
    )
    expect(history).toEqual([
      { activityId: 'schedule:t1', reportDate: '2026-10-04', percentComplete: 95, savedAt: '2026-10-04T09:00:00Z' },
      { activityId: 'package:p1', reportDate: '2026-10-04', percentComplete: 30, savedAt: undefined },
    ])
  })

  it('merge keeps one entry per day, the latest wins, and the daily increment survives', () => {
    const server = [
      { activityId: 'schedule:t1', reportDate: '2026-10-04', percentComplete: 95, savedAt: '2026-10-04T09:00:00Z' },
      { activityId: 'schedule:t1', reportDate: '2026-10-05', percentComplete: 100, savedAt: '2026-10-05T06:00:01Z' },
    ]
    const local = [{ activityId: 'schedule:t1', reportDate: '2026-10-05', percentComplete: 100, dailyIncrement: 5, savedAt: '2026-10-05T06:00:00Z' }]
    const merged = mergeProgressHistory(server, local)
    expect(merged).toHaveLength(2)
    expect(merged.find((m) => m.reportDate === '2026-10-05')).toMatchObject({ percentComplete: 100, dailyIncrement: 5 })
    expect(cumulativeBefore('schedule:t1', merged, '2026-10-05', 100)).toBe(95)
  })
})

describe('buildActivityProgressTimeline', () => {
  it('the first report counts in full, so week gains add up to the cumulative', () => {
    const entries = [e('2026-09-21', 50), e('2026-09-23', 50), e('2026-10-01', 61)]
    const weeks = buildActivityProgressTimeline('a1', entries, '2026-10-01')
    expect(weeks.map((w) => [w.gain, w.endCumulative])).toEqual([
      [50, 50],
      [11, 61],
    ])
  })

  it('covers every week from the first day with progress, with each week gain and closing cumulative', () => {
    const entries = [e('2026-09-15', 0), { ...e('2026-09-22', 5), dailyIncrement: 5 }, e('2026-09-24', 10), e('2026-10-03', 15), e('2026-10-05', 22)]
    const weeks = buildActivityProgressTimeline('a1', entries, '2026-10-05')
    expect(weeks.map((w) => [w.index, w.weekStart, w.gain, w.endCumulative, w.weekComplete])).toEqual([
      [1, '2026-09-19', 10, 10, true],
      [2, '2026-09-26', null, 10, true],
      [3, '2026-10-03', 12, 22, false],
    ])
    expect(weeks[0]!.days.map((d) => [d.date, d.daily])).toEqual([
      ['2026-09-22', 5],
      ['2026-09-23', null],
      ['2026-09-24', 5],
    ])
  })

  it('only the current week before any report', () => {
    expect(buildActivityProgressTimeline('a1', [], '2026-10-05').map((w) => w.weekStart)).toEqual(['2026-10-03'])
  })
})

describe('reportedDays / calendarDays', () => {
  it('lists each report with the progress gained that day', () => {
    expect(reportedDays('a1', [e('2026-09-21', 50), e('2026-09-23', 50), e('2026-10-01', 61)])).toEqual([
      { date: '2026-09-21', daily: 50, cumulative: 50 },
      { date: '2026-09-23', daily: 0, cumulative: 50 },
      { date: '2026-10-01', daily: 11, cumulative: 61 },
    ])
  })

  it('every calendar day of a range', () => {
    expect(calendarDays('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })
})

describe('cumulativeEntry / withLatestReports', () => {
  const entries = [e('2026-09-30', 40), e('2026-10-01', 55), e('2026-10-03', 65)]

  it('sets that day cumulative, capped at 100; the daily progress is the rise over the day before', () => {
    expect(cumulativeEntry('a1', entries, '2026-10-01', 50)).toEqual({
      activityId: 'a1',
      reportDate: '2026-10-01',
      percentComplete: 50,
      dailyIncrement: 10,
    })
    expect(cumulativeEntry('a1', entries, '2026-10-04', 130).percentComplete).toBe(100)
    expect(cumulativeEntry('new', entries, '2026-09-21', 30).dailyIncrement).toBe(30)
  })

  it('withoutDay drops that day under any id form; latestReport is the newest left', () => {
    const mixed = [e('2026-10-01', 55, 'schedule:t1'), e('2026-10-03', 100, 't1'), e('2026-10-03', 40, 'other')]
    const left = withoutDay('schedule:t1', mixed, '2026-10-03')
    expect(left.map((r) => [r.activityId, r.reportDate])).toEqual([
      ['schedule:t1', '2026-10-01'],
      ['other', '2026-10-03'],
    ])
    expect(latestReport('schedule:t1', left)?.percentComplete).toBe(55)
  })

  it('re-sends the latest later report so the schedule ends on it', () => {
    const changed = [cumulativeEntry('a1', entries, '2026-10-01', 50)]
    expect(withLatestReports(changed, entries).map((r) => [r.reportDate, r.percentComplete])).toEqual([
      ['2026-10-01', 50],
      ['2026-10-03', 65],
    ])
    const latest = [cumulativeEntry('a1', entries, '2026-10-03', 70)]
    expect(withLatestReports(latest, entries)).toHaveLength(1)
  })
})
