import type { TaskRelationType } from '@/shared/types/schedule'
import {
  addWorkdays,
  countWorkdays,
  diffWorkdays,
  everyDayWorks,
  nextWorkday,
  type IsWorkday,
} from '@/features/holidays/lib/work-calendar'

export interface ForecastTask {
  id: string
  wbs: string | null
  parentId: string | null
  isSummary: boolean
  isMilestone: boolean
  /** Approved plan (start_planned / finish_planned), YYYY-MM-DD. */
  plannedStart: string | null
  plannedFinish: string | null
  actualStart: string | null
  actualFinish: string | null
  /** Physical percent complete, 0–100. */
  percent: number
  /**
   * Progress of unknown timing (never reported, imported percent): the activity is placed where its
   * predecessors allow at its planned duration, without being held back to the status date.
   */
  followsPlan?: boolean
  /** First day of the remaining work when in progress (default the status date), e.g. after a report covering the status date. */
  workFrom?: string
}

export interface ForecastLink {
  predecessorId: string
  successorId: string
  type: TaskRelationType
  lagDays: number
}

export interface ForecastDates {
  start: string
  finish: string
}

const maxIso = (a: string, b: string) => (a > b ? a : b)
const minIso = (a: string, b: string) => (a < b ? a : b)

/** Working days of a planned window, both ends included (at least 1); 0 for a milestone. */
function durationOf(task: ForecastTask, isWorkday: IsWorkday): number {
  if (task.isMilestone) return 0
  if (!task.plannedStart || !task.plannedFinish) return 1
  return Math.max(1, countWorkdays(task.plannedStart, task.plannedFinish, isWorkday))
}

/** Finish of `duration` working days beginning on the first working day from `start`. */
const finishFrom = (start: string, duration: number, isWorkday: IsWorkday) =>
  duration <= 0 ? start : addWorkdays(nextWorkday(start, isWorkday), duration - 1, isWorkday)

/** Earliest successor start one link allows, in working days with inclusive finishes (FS starts the next one). */
function linkStart(
  pred: ForecastDates,
  predIsMilestone: boolean,
  link: ForecastLink,
  succDuration: number,
  succIsMilestone: boolean,
  isWorkday: IsWorkday
): string {
  const lag = link.lagDays
  const back = Math.max(0, succDuration - 1)
  switch (link.type) {
    case 'SS':
      return addWorkdays(pred.start, lag, isWorkday)
    case 'FF':
      return addWorkdays(pred.finish, lag - back, isWorkday)
    case 'SF':
      return addWorkdays(pred.start, lag - 1 - back, isWorkday)
    case 'FS':
    default:
      return addWorkdays(pred.finish, lag + (predIsMilestone || succIsMilestone ? 0 : 1), isWorkday)
  }
}

/**
 * Re-forecasts the schedule from the progress reported up to `statusDate` (Tehran civil day),
 * the way MS Project's "update project" does, keeping the approved plan untouched:
 * - finished activities keep their actual dates;
 * - an activity in progress keeps its start (never later than the status date) and does the rest of its
 *   work from the status date at the planned rate: remaining days = duration × (1 − percent);
 * - an activity not started follows its predecessors' forecasts through the dependency links, keeping
 *   the offset its plan had from its latest link (calendar or constraint days), and never starts before
 *   the status date. Without predecessors it keeps its planned start unless that has passed.
 * Summary activities span their children. While every activity is on its plan, the forecast is the plan.
 * Durations, lags and moves count working days of `isWorkday` (default: every day); an activity left
 * where its plan put it keeps its planned dates even when they fall on a day off.
 */
export function forecastSchedule(input: {
  tasks: ForecastTask[]
  links: ForecastLink[]
  statusDate: string
  isWorkday?: IsWorkday
}): Map<string, ForecastDates> {
  const { statusDate } = input
  const isWorkday = input.isWorkday ?? everyDayWorks
  const tasks = input.tasks.filter((t) => t.plannedStart || t.actualStart)
  const byId = new Map(tasks.map((t) => [t.id, t]))

  const childrenOf = new Map<string, string[]>()
  const wbsIndex = new Map(tasks.filter((t) => t.wbs).map((t) => [t.wbs!.trim(), t.id]))
  const parentOf = new Map<string, string>()
  for (const t of tasks) {
    let parent = t.parentId && byId.has(t.parentId) ? t.parentId : null
    if (!parent && t.wbs?.includes('.')) parent = wbsIndex.get(t.wbs.trim().replace(/\.[^.]+$/, '')) ?? null
    if (!parent) continue
    parentOf.set(t.id, parent)
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), t.id])
  }
  const isGroup = (t: ForecastTask) => t.isSummary || (childrenOf.get(t.id)?.length ?? 0) > 0

  const linksInto = new Map<string, ForecastLink[]>()
  for (const l of input.links) {
    if (l.predecessorId === l.successorId || !byId.has(l.predecessorId) || !byId.has(l.successorId)) continue
    linksInto.set(l.successorId, [...(linksInto.get(l.successorId) ?? []), l])
  }
  /** Links into the task and into every summary above it. */
  const constraintsOf = (id: string): ForecastLink[] => {
    const out: ForecastLink[] = []
    for (let cur: string | undefined = id; cur; cur = parentOf.get(cur)) out.push(...(linksInto.get(cur) ?? []))
    return out
  }

  const planned = new Map<string, ForecastDates | null>()
  const plannedOf = (id: string): ForecastDates | null => {
    if (planned.has(id)) return planned.get(id)!
    const t = byId.get(id)!
    const start = t.plannedStart ?? t.actualStart!
    const value = { start, finish: t.plannedFinish ?? start }
    planned.set(id, value)
    return value
  }

  /** Latest start the links allow, from the given predecessor dates; null without links. */
  const latestLinkStart = (task: ForecastTask, datesOf: (id: string) => ForecastDates | null): string | null => {
    const duration = durationOf(task, isWorkday)
    let latest: string | null = null
    for (const link of constraintsOf(task.id)) {
      const pred = datesOf(link.predecessorId)
      if (!pred) continue
      const cand = linkStart(pred, byId.get(link.predecessorId)!.isMilestone, link, duration, task.isMilestone, isWorkday)
      if (!latest || cand > latest) latest = cand
    }
    return latest
  }

  const memo = new Map<string, ForecastDates | null>()
  const visiting = new Set<string>()
  const forecastOf = (id: string): ForecastDates | null => {
    if (memo.has(id)) return memo.get(id)!
    // A dependency loop: the link that closes it is ignored.
    if (visiting.has(id)) return null
    visiting.add(id)
    const t = byId.get(id)!
    let value: ForecastDates | null

    if (isGroup(t)) {
      const kids = (childrenOf.get(id) ?? []).map(forecastOf).filter((d): d is ForecastDates => d != null)
      value = kids.length
        ? { start: kids.map((d) => d.start).reduce(minIso), finish: kids.map((d) => d.finish).reduce(maxIso) }
        : plannedOf(id)
    } else {
      const plan = plannedOf(id)!
      const duration = durationOf(t, isWorkday)
      if (t.percent >= 100 && !t.followsPlan) {
        const start = t.actualStart ?? plan.start
        value = { start, finish: maxIso(t.actualFinish ?? plan.finish, start) }
      } else if (t.percent > 0 && !t.followsPlan) {
        // Work already reported has started by the status date, whatever start was recorded.
        const start = minIso(t.actualStart ?? plan.start, statusDate)
        const remaining = Math.max(1, Math.ceil(Math.max(duration, 1) * (1 - t.percent / 100) - 1e-9))
        value = { start, finish: finishFrom(maxIso(t.workFrom ?? statusDate, statusDate), remaining, isWorkday) }
      } else {
        const forecastLink = latestLinkStart(t, forecastOf)
        const planLink = forecastLink == null ? null : latestLinkStart(t, plannedOf)
        // The activity moves by as many working days as its latest link slipped, keeping its planned
        // offset from that link (which may be negative when a loop or an overridden link let it start early).
        let start = plan.start
        if (forecastLink != null) {
          start = planLink ? addWorkdays(plan.start, diffWorkdays(planLink, forecastLink, isWorkday), isWorkday) : forecastLink
        }
        if (!t.followsPlan && start < statusDate) start = nextWorkday(statusDate, isWorkday)
        let finish = start === plan.start ? plan.finish : finishFrom(start, duration, isWorkday)
        if (t.followsPlan && t.percent > 0 && t.percent < 100) {
          // Unfinished work of unknown timing cannot have finished before the status date.
          const remaining = Math.max(1, Math.ceil(Math.max(duration, 1) * (1 - t.percent / 100) - 1e-9))
          finish = maxIso(finish, finishFrom(statusDate, remaining, isWorkday))
        }
        value = { start, finish }
      }
    }

    visiting.delete(id)
    memo.set(id, value)
    return value
  }

  const out = new Map<string, ForecastDates>()
  for (const t of tasks) {
    const d = forecastOf(t.id)
    if (d) out.set(t.id, d)
  }
  return out
}
