import { describe, expect, it } from 'vitest'
import {
  activityWeek,
  evaluationOpensAt,
  isCommitmentFrozen,
  isEvaluationOpen,
  plannedCumulativeAt,
  ppcStatusOf,
  siteWeekOf,
  weeklyPlanSlice,
  weekPpc,
} from '@/features/project-store/lib/weekly-engine'
import { groupWindows } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'

const SAT = '2026-10-03'
const report = (activityId: string, reportDate: string, percentComplete: number): DailyProgressEntry => ({
  activityId,
  reportDate,
  percentComplete,
})

describe('weekly engine', () => {
  it('runs the site week Saturday–Thursday', () => {
    expect(siteWeekOf('2026-10-07')).toEqual({ start: SAT, end: '2026-10-08' })
    expect(siteWeekOf('2026-10-09')).toEqual({ start: SAT, end: '2026-10-08' })
  })

  it('freezes on Saturday 00:00 and opens evaluation on Thursday 16:00 Tehran', () => {
    expect(evaluationOpensAt(SAT)).toBe(Date.parse('2026-10-08T12:30:00Z'))
    expect(isEvaluationOpen(SAT, Date.parse('2026-10-08T12:29:00Z'))).toBe(false)
    expect(isEvaluationOpen(SAT, Date.parse('2026-10-08T12:30:00Z'))).toBe(true)
    expect(isCommitmentFrozen(SAT, Date.parse('2026-10-02T20:29:00Z'))).toBe(false)
    expect(isCommitmentFrozen(SAT, Date.parse('2026-10-02T20:30:00Z'))).toBe(true)
  })

  it('slices the plan over working days and skips holidays', () => {
    const window = { start: '2026-09-29', finish: '2026-10-08' }
    expect(plannedCumulativeAt(window, '2026-10-02')).toBe(33.33)
    expect(plannedCumulativeAt(window, '2026-10-08')).toBe(100)
    expect(weeklyPlanSlice(window, SAT)).toBe(66.67)
    // A holiday on Monday 10-05 moves one working day out of the window.
    const withHoliday = (iso: string) => iso !== '2026-10-05' && new Date(`${iso}T00:00:00Z`).getUTCDay() !== 5
    expect(weeklyPlanSlice(window, SAT, withHoliday)).toBe(62.5)
  })

  it('scores binary PPC only after evaluation opens', () => {
    expect(ppcStatusOf(20, 20, true)).toBe(1)
    expect(ppcStatusOf(20, 19.99, true)).toBe(0)
    expect(ppcStatusOf(20, 25, false)).toBeNull()
    expect(ppcStatusOf(0, 5, true)).toBeNull()
  })

  it('caps the target by what is left and derives daily logs from cumulative reports', () => {
    const week = activityWeek({
      activity: { id: 'a', approved: { start: '2026-09-29', finish: '2026-10-08' }, baselinePercent: 0 },
      entries: [report('a', '2026-10-01', 80), report('a', '2026-10-04', 90), report('a', '2026-10-06', 100)],
      windows: groupWindows([]),
      weekStart: SAT,
      today: '2026-10-09',
      nowMs: Date.parse('2026-10-09T08:00:00Z'),
    })
    expect(week).toMatchObject({ target: 20, cumulativeBefore: 80, cumulativeAfter: 100, actualSum: 20, ppcStatus: 1 })
    expect(week.dailyLogs).toEqual({ '2026-10-04': 10, '2026-10-06': 10 })
  })

  it('counts completed ÷ committed for the week', () => {
    const nowMs = Date.parse('2026-10-09T08:00:00Z')
    const base = { activity: { id: '', approved: { start: '2026-09-29', finish: '2026-10-18' }, baselinePercent: 0 }, windows: groupWindows([]), weekStart: SAT, today: '2026-10-09', nowMs }
    const met = activityWeek({ ...base, activity: { ...base.activity, id: 'm' }, entries: [report('m', '2026-10-08', 40)] })
    const missed = activityWeek({ ...base, activity: { ...base.activity, id: 'x' }, entries: [report('x', '2026-10-08', 10)] })
    expect(weekPpc([met, missed], SAT, nowMs)).toMatchObject({ committed: 2, completed: 1, ppc: 50, provisional: false })
  })
})
