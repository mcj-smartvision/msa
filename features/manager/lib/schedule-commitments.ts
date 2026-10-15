import type { ActivityWindows } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { siteWeekStart } from '@/features/supervisor/lib/weekly-activity-progress'
import { activityWeek, addDays, round2, SITE_WEEK_DAYS, weekPpc } from '@/features/project-store/lib/weekly-engine'
import { ROOT_CAUSE_CATEGORIES, ROOT_CAUSE_FA, type RootCauseCategory } from '@/features/wwp/lib/policy'
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

/** Recorded reason for a missed commitment, keyed `${activityId}@${weekStart}`. */
export interface CommitmentRnc {
  category: string
  note: string | null
}

export const rncKey = (activityId: string, weekStart: string) => `${activityId}@${weekStart}`

const asRootCause = (value: string | null | undefined): RootCauseCategory | null =>
  value && (ROOT_CAUSE_CATEGORIES as readonly string[]).includes(value) ? (value as RootCauseCategory) : null

interface ScoredWeek extends PpcWeek {
  commitments: WeekCommitment[]
}

/**
 * Until committed weekly plans exist, a week's commitments are the schedule itself (the weekly engine of
 * the project store): each activity's share of the plan for the Saturday–Thursday week, from the forecast
 * window frozen on Saturday morning and sliced over working days. From Thursday 16:00 each commitment
 * scores 1 only when the week's reported gain reaches its share; the running week is provisional.
 */
export function buildScheduleCommitments(input: {
  /** start / finish: the approved plan, used before the forecast windows begin. */
  activities: CommitmentActivity[]
  entries: DailyProgressEntry[]
  today: string
  /** Day-by-day windows from the progress forecast (computeCommitmentWindows). */
  windows?: ActivityWindows
  isWorkday?: (iso: string) => boolean
  nowMs?: number
  rnc?: Map<string, CommitmentRnc>
}): WeeklyCommitmentsData | null {
  const { entries, today } = input
  const windows: ActivityWindows = input.windows ?? new Map()
  const nowMs = input.nowMs ?? Date.now()
  const rnc = input.rnc ?? new Map<string, CommitmentRnc>()

  const starts = input.activities.flatMap((a) => [a.start, ...(windows.get(a.id) ?? []).map((w) => w.start)]).filter((d): d is string => !!d)
  if (starts.length === 0) return null

  const firstWeek = siteWeekStart(starts.reduce((min, d) => (d < min ? d : min)))
  const lastWeek = siteWeekStart(today)

  const scored: ScoredWeek[] = []
  for (let start = firstWeek, n = 1; start <= lastWeek; start = addDays(start, 7), n++) {
    const weeks = input.activities.map((a) => ({
      activity: a,
      week: activityWeek({
        activity: { id: a.id, approved: { start: a.start, finish: a.finish }, baselinePercent: a.baselinePercent },
        entries,
        windows,
        weekStart: start,
        today,
        nowMs,
        isWorkday: input.isWorkday,
      }),
    }))
    const summary = weekPpc(weeks.map((w) => w.week), start, nowMs)
    if (summary.committed === 0) continue

    const commitments = weeks
      .filter(({ week }) => week.target > 0)
      .map<WeekCommitment>(({ activity, week }) => {
        const completed = summary.provisional ? week.provisionalMet === true : week.ppcStatus === 1
        const reason = completed ? undefined : rnc.get(rncKey(activity.id, start))
        const cause = asRootCause(reason?.category)
        return {
          activityId: activity.id,
          description: activity.name,
          wbs: activity.wbs,
          completed,
          rootCause: cause,
          rootCauseLabel: cause ? ROOT_CAUSE_FA[cause] : null,
          rootCauseNote: reason?.note ?? null,
          progressPercent: Math.min(100, Math.max(0, (week.actualSum / week.target) * 100)),
          targetPercent: week.target,
          actualPercent: round2(week.actualSum),
        }
      })
    scored.push({
      weekNumber: n,
      start,
      end: addDays(start, SITE_WEEK_DAYS - 1),
      planned: summary.committed,
      completed: summary.completed,
      ppc: summary.ppc,
      live: summary.provisional,
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

  const counts = new Map<RootCauseCategory, number>()
  for (const week of window) {
    for (const c of week.commitments) {
      if (c.completed || !c.rootCause) continue
      counts.set(c.rootCause, (counts.get(c.rootCause) ?? 0) + 1)
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  const causes = [...counts.entries()]
    .map(([key, count]) => ({ key, label: ROOT_CAUSE_FA[key], count, share: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count)
  const top3 = causes.slice(0, 3).reduce((s, c) => s + c.count, 0)

  return {
    source: 'schedule',
    target: PPC_TARGET,
    weeks: history.map(({ commitments: _c, ...w }) => w),
    current,
    previousPpc: previous?.ppc ?? null,
    average4: ppcOf(planned4, completed4),
    rnc: { weeks: window.length, total, causes, top3Share: total > 0 ? (top3 / total) * 100 : null },
  }
}