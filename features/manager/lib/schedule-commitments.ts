import { normalizeWindow, plannedPercentInWindow } from '@/features/schedule/lib/planned-progress'
import { windowOn, type ActivityWindows } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { cumulativeBefore, siteWeekStart } from '@/features/supervisor/lib/weekly-activity-progress'
import {
PPC_HISTORY_WEEKS,
PPC_TARGET,
ppcOf,
RNC_WINDOW_WEEKS,
type PpcWeek,
type WeekCommitment,
type WeeklyCommitmentsData,
} from './weekly-commitments'

/** One activity the daily report collects progress for, with the schedule window that drives its plan. */
export interface CommitmentActivity {
  id: string
  name: string
  wbs: string | null
  start: string | null
  finish: string | null
  /** Stored schedule percent, used only for an activity that was never reported. */
  baselinePercent: number
}

const DAY_MS = 86_400_000
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const round2 = (v: number) => Math.round(v * 100) / 100

interface ScoredWeek extends PpcWeek {
  commitments: WeekCommitment[]
}

/**
 * Until committed weekly plans exist, a week's commitments are the schedule itself: every activity
 * whose window overlaps the site week (Saturday–Thursday). The window follows the progress forecast as
 * it stood on Thursday (today for the running week), so early and late predecessors move it at once.
 * An activity scores when its reported cumulative percent at the end of Thursday reaches the plan's
 * cumulative percent for that Thursday (calendar days, like the S-curve).
 */
export function buildScheduleCommitments(input: {
  /** start / finish: the approved plan, used before the forecast windows begin. */
  activities: CommitmentActivity[]
  entries: DailyProgressEntry[]
  today: string
  /** Day-by-day windows from the progress forecast (computeCommitmentWindows). */
  windows?: ActivityWindows
}): WeeklyCommitmentsData | null {
  const { entries, today } = input
  const windows: ActivityWindows = input.windows ?? new Map()
  const windowIn = (a: CommitmentActivity, date: string) =>
    normalizeWindow(windowOn(windows, a.id, date, { start: a.start, finish: a.finish }))

  const starts = input.activities.flatMap((a) => [
    a.start,
    ...(windows.get(a.id) ?? []).map((w) => w.start),
  ]).filter((d): d is string => !!d)
  if (starts.length === 0) return null

  const firstWeek = siteWeekStart(starts.reduce((min, d) => (d < min ? d : min)))
  const lastWeek = siteWeekStart(today)

  const scored: ScoredWeek[] = []
  for (let start = firstWeek, n = 1; start <= lastWeek; start = addDays(start, 7), n++) {
    const end = addDays(start, 5)
    const live = end >= today
    const asOf = live ? today : end
    const committed = input.activities
      .map((a) => ({ ...a, window: windowIn(a, asOf) }))
      .filter((a): a is typeof a & { window: { start: string; finish: string } } =>
        a.window != null && a.window.start <= end && a.window.finish >= start
      )
    if (committed.length === 0) continue

    const commitments = committed.map<WeekCommitment>((a) => {
      const targetPercent = round2(plannedPercentInWindow(a.window, end))
      const actualPercent = round2(cumulativeBefore(a.id, entries, addDays(asOf, 1), a.baselinePercent) ?? 0)
      return {
        description: a.name,
        wbs: a.wbs,
        completed: actualPercent >= targetPercent,
        rootCause: null,
        rootCauseLabel: null,
        rootCauseNote: null,
        progressPercent: targetPercent > 0 ? Math.min(100, (actualPercent / targetPercent) * 100) : 100,
        targetPercent,
        actualPercent,
      }
    })
    const completed = commitments.filter((c) => c.completed).length
    scored.push({
      weekNumber: n,
      start,
      end,
      planned: commitments.length,
      completed,
      ppc: ppcOf(commitments.length, completed),
      live,
      commitments: commitments.sort(
        (a, b) => Number(a.completed) - Number(b.completed) || (a.progressPercent ?? 0) - (b.progressPercent ?? 0)
      ),
    })
  }
  if (scored.length === 0) return null

  const closed = scored.filter((w) => !w.live)
  const liveWeek = scored.find((w) => w.live) ?? null
  const history = [...closed.slice(-PPC_HISTORY_WEEKS), ...(liveWeek ? [liveWeek] : [])]
  const current = liveWeek ?? closed[closed.length - 1] ?? null
  const previous = liveWeek ? closed[closed.length - 1] : closed[closed.length - 2]

  const window = closed.slice(-RNC_WINDOW_WEEKS)
  const planned4 = window.reduce((s, w) => s + w.planned, 0)
  const completed4 = window.reduce((s, w) => s + w.completed, 0)

  return {
    source: 'schedule',
    target: PPC_TARGET,
    weeks: history.map(({ commitments: _c, ...w }) => w),
    current,
    previousPpc: previous?.ppc ?? null,
    average4: ppcOf(planned4, completed4),
    rnc: { weeks: window.length, total: 0, causes: [], top3Share: null },
  }
}
