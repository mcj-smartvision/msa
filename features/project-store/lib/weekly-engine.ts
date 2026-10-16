/**
 * @file features/project-store/lib/weekly-engine.ts
 * @purpose منطق دامنه — ذخیره پیشرفت و overlay اعداد داشبورد (weekly-engine)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on features/supervisor/lib/progress-ledger, features/supervisor/lib/daily-report-activities, features/supervisor/lib/weekly-activity-progress, features/schedule/lib/week-commitment-windows, shared/lib/time/tehran
 */

import { isSiteWorkday, plannedProgressFrom, plannedWorkdays } from '@/features/supervisor/lib/progress-ledger'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { cumulativeBefore, reportedDays, siteWeekStart } from '@/features/supervisor/lib/weekly-activity-progress'
import { windowOn, type ActivityWindow, type ActivityWindows } from '@/features/schedule/lib/week-commitment-windows'
import { tehranMidnight } from '@/shared/lib/time/tehran'

/**
 * Weekly commitment cycle (Last Planner) on the site calendar: the week runs Saturday–Thursday, Friday
 * and registered holidays are off. On Saturday the week's commitments are frozen from the forecast
 * window in force that morning; on Thursday at 16:00 (Tehran) evaluation opens and every commitment
 * scores 1 only when the week's reported gain reaches its target — any shortfall scores 0 and needs an RNC.
 */

export const SITE_WEEK_DAYS = 6
export const EVALUATION_UNLOCK_HOUR = 16

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
export const round2 = (n: number) => Math.round(n * 100) / 100

export function siteWeekOf(iso: string): { start: string; end: string } {
  const start = siteWeekStart(iso)
  return { start, end: addDays(start, SITE_WEEK_DAYS - 1) }
}

function midnightOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return tehranMidnight(y!, m!, d!)
}

/** Saturday 00:00 Tehran: the week's commitments stop changing. */
export const commitmentsFreezeAt = (weekStart: string) => midnightOf(weekStart)

/** Thursday 16:00 Tehran: the week can be evaluated. */
export const evaluationOpensAt = (weekStart: string) =>
  midnightOf(addDays(weekStart, SITE_WEEK_DAYS - 1)) + EVALUATION_UNLOCK_HOUR * HOUR_MS

export const isEvaluationOpen = (weekStart: string, nowMs: number) => nowMs >= evaluationOpensAt(weekStart)
export const isCommitmentFrozen = (weekStart: string, nowMs: number) => nowMs >= commitmentsFreezeAt(weekStart)

/** Planned cumulative percent at the end of `date`, sliced evenly over the window's working days. */
export function plannedCumulativeAt(window: ActivityWindow, date: string, isWorkday: (iso: string) => boolean = isSiteWorkday): number {
  if (!window.start || date < window.start) return 0
  const finish = window.finish && window.finish >= window.start ? window.finish : window.start
  if (date >= finish) return 100
  const workdays = plannedWorkdays(window.start, finish, isWorkday)
  if (workdays <= 0) return 0
  let cumulative = 0
  for (const [d, planned] of plannedProgressFrom(window.start, workdays, isWorkday)) {
    if (d > date) break
    cumulative = planned.cumulative
  }
  return cumulative
}

/** The week's share of the plan: planned cumulative at Thursday minus planned cumulative before Saturday. */
export function weeklyPlanSlice(window: ActivityWindow, weekStart: string, isWorkday: (iso: string) => boolean = isSiteWorkday): number {
  const end = addDays(weekStart, SITE_WEEK_DAYS - 1)
  return round2(Math.max(0, plannedCumulativeAt(window, end, isWorkday) - plannedCumulativeAt(window, addDays(weekStart, -1), isWorkday)))
}

/** Binary PPC: null without a commitment or before evaluation opens; otherwise 1 only for full achievement. */
export function ppcStatusOf(target: number, actualSum: number, evaluationOpen: boolean): 0 | 1 | null {
  if (!(target > 0) || !evaluationOpen) return null
  return round2(actualSum) >= round2(target) ? 1 : 0
}

export interface CommitmentActivityInput {
  id: string
  /** Approved plan, used before the forecast windows begin. */
  approved: ActivityWindow
  /** Stored schedule percent, used only for a never-reported activity. */
  baselinePercent: number
}

export interface ActivityWeek {
  weekStart: string
  weekEnd: string
  /** Forecast window frozen on Saturday morning. */
  window: ActivityWindow
  /** Planned share of this week, capped by what is left of the activity. */
  target: number
  /** Cumulative before Saturday and at the end of Thursday (today while the week runs). */
  cumulativeBefore: number
  cumulativeAfter: number
  actualSum: number
  /** Gain of each reported day of the week. */
  dailyLogs: Record<string, number>
  evaluationOpen: boolean
  frozen: boolean
  ppcStatus: 0 | 1 | null
  /** The comparison as it stands now (also before evaluation opens). */
  provisionalMet: boolean | null
}

export function activityWeek(input: {
  activity: CommitmentActivityInput
  entries: DailyProgressEntry[]
  windows: ActivityWindows
  weekStart: string
  today: string
  nowMs: number
  isWorkday?: (iso: string) => boolean
}): ActivityWeek {
  const { activity, entries, weekStart, today, nowMs } = input
  const isWorkday = input.isWorkday ?? isSiteWorkday
  const weekEnd = addDays(weekStart, SITE_WEEK_DAYS - 1)
  const window = windowOn(input.windows, activity.id, weekStart, activity.approved)
  const before = cumulativeBefore(activity.id, entries, weekStart, activity.baselinePercent) ?? 0
  const asOf = today < weekEnd ? today : weekEnd
  const after = asOf < weekStart ? before : cumulativeBefore(activity.id, entries, addDays(asOf, 1), activity.baselinePercent) ?? before
  const target = round2(Math.min(weeklyPlanSlice(window, weekStart, isWorkday), Math.max(0, 100 - before)))
  const actualSum = round2(after - before)
  const dailyLogs: Record<string, number> = {}
  for (const day of reportedDays(activity.id, entries, activity.baselinePercent)) {
    if (day.date >= weekStart && day.date <= weekEnd && day.daily != null) dailyLogs[day.date] = day.daily
  }
  const evaluationOpen = isEvaluationOpen(weekStart, nowMs)
  return {
    weekStart,
    weekEnd,
    window,
    target,
    cumulativeBefore: round2(before),
    cumulativeAfter: round2(after),
    actualSum,
    dailyLogs,
    evaluationOpen,
    frozen: isCommitmentFrozen(weekStart, nowMs),
    ppcStatus: ppcStatusOf(target, actualSum, evaluationOpen),
    provisionalMet: target > 0 ? round2(actualSum) >= target : null,
  }
}

/** Every reported day's gain of an activity (the supervisor's daily logs), oldest first. */
export function dailyLogsOf(activityId: string, entries: DailyProgressEntry[], baselinePercent: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const day of reportedDays(activityId, entries, baselinePercent)) if (day.daily != null) out[day.date] = day.daily
  return out
}

export interface WeekPpc {
  weekStart: string
  weekEnd: string
  committed: number
  completed: number
  /** completed ÷ committed × 100; null without commitments. */
  ppc: number | null
  /** Evaluation has not opened yet: the numbers are the comparison as it stands now. */
  provisional: boolean
}

/** Share of the week's commitments fully met (each one scores 0 or 1). */
export function weekPpc(weeks: ActivityWeek[], weekStart: string, nowMs: number): WeekPpc {
  const committed = weeks.filter((w) => w.target > 0)
  const provisional = !isEvaluationOpen(weekStart, nowMs)
  const completed = committed.filter((w) => (provisional ? w.provisionalMet : w.ppcStatus === 1)).length
  return {
    weekStart,
    weekEnd: addDays(weekStart, SITE_WEEK_DAYS - 1),
    committed: committed.length,
    completed,
    ppc: committed.length > 0 ? (completed / committed.length) * 100 : null,
    provisional,
  }
}
