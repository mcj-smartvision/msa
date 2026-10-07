import { addDaysIso } from '@/features/schedule/lib/dates'
import type { IsWorkday } from '@/features/holidays/lib/work-calendar'
import {
  forecastSchedule,
  type ForecastDates,
  type ForecastLink,
  type ForecastTask,
} from '@/features/schedule/lib/progress-forecast'
import type { WindowChange } from '@/features/schedule/lib/week-commitment-windows'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'

/** A daily-report activity and the schedule task whose forecast window it follows. */
export interface ReplayActivity {
  id: string
  taskId: string | null
  weight: number
}

interface Reported {
  percent: number
  start: string | null
  finish: string | null
  followsPlan?: boolean
}

/** Reported state of one activity before `date`: last cumulative, first day above 0 and first day at 100. */
function reportedBefore(history: DailyProgressEntry[], date: string): Reported {
  const out: Reported = { percent: 0, start: null, finish: null }
  for (const e of history) {
    if (e.reportDate >= date) break
    out.percent = e.percentComplete
    if (out.percent > 0 && !out.start) out.start = e.reportDate
    if (out.percent >= 100 && !out.finish) out.finish = e.reportDate
  }
  return out
}

/**
 * A task nobody ever reported: still at 0 today means it never started; otherwise (progress imported
 * from MSP or catch-up, timing unknown) it is taken as having followed its plan, moved by its predecessors,
 * with any unfinished part still left after the status date. Its stored actual dates are not used.
 */
function unreported(task: ForecastTask): Reported {
  return task.percent > 0
    ? { percent: task.percent, start: null, finish: null, followsPlan: true }
    : { percent: 0, start: null, finish: null }
}

export interface ReportedProgressInput {
  /** Schedule tasks with today's stored percent. */
  tasks: ForecastTask[]
  activities: ReplayActivity[]
  entries: DailyProgressEntry[]
}

/** A reported task's progress, start and finish as its daily reports stood up to the end of a date. */
export interface ReportedTaskState {
  percent: number
  start: string | null
  finish: string | null
}

/**
 * Task progress as the daily reports stood on a date. A task with daily-report activities takes their
 * weighted percent; its start is the first reported day above 0 and its finish the day all reached 100.
 * Until its first report such a task counts as not started (see `unreported` for tasks never reported).
 */
function reportedProgress(input: ReportedProgressInput) {
  const historyOf = new Map<string, DailyProgressEntry[]>()
  for (const e of input.entries) historyOf.set(e.activityId, [...(historyOf.get(e.activityId) ?? []), e])
  for (const list of historyOf.values()) list.sort((a, b) => a.reportDate.localeCompare(b.reportDate))

  const activitiesOf = new Map<string, ReplayActivity[]>()
  for (const a of input.activities) {
    if (a.taskId) activitiesOf.set(a.taskId, [...(activitiesOf.get(a.taskId) ?? []), a])
  }

  const reportedOn = (task: ForecastTask, date: string) =>
    (activitiesOf.get(task.id) ?? []).some((a) => historyOf.get(a.id)?.some((e) => e.reportDate === date))

  const stateAt = (task: ForecastTask, date: string): Reported => {
    const acts = activitiesOf.get(task.id) ?? []
    if (!acts.some((a) => historyOf.has(a.id))) return unreported(task)
    let weighted = 0
    let total = 0
    let start: string | null = null
    let finish: string | null = null
    let allDone = true
    for (const a of acts) {
      const r = reportedBefore(historyOf.get(a.id) ?? [], date)
      const w = a.weight > 0 ? a.weight : 1
      weighted += w * r.percent
      total += w
      if (r.start && (!start || r.start < start)) start = r.start
      if (!r.finish) allDone = false
      else if (!finish || r.finish > finish) finish = r.finish
    }
    const percent = total > 0 ? weighted / total : 0
    return allDone && percent >= 100 ? { percent: 100, start, finish } : { percent: Math.min(percent, 99.99), start, finish: null }
  }

  const withState = (t: ForecastTask, s: Reported, workFrom?: string): ForecastTask => ({
    ...t,
    percent: s.percent,
    actualStart: s.start,
    actualFinish: s.finish,
    followsPlan: s.followsPlan,
    workFrom,
  })

  /**
   * Every task as reported up to the end of `date` (work left after a same-day report starts the next
   * day), each task as it stood that morning, and the tasks reported on `date`.
   */
  const onDate = (date: string) => {
    const nextDay = addDaysIso(date, 1)
    const morning = new Map<string, ForecastTask>()
    const changed = new Set<string>()
    const evening = input.tasks.map((t) => {
      if (t.isSummary) return t
      morning.set(t.id, withState(t, stateAt(t, date)))
      if (!reportedOn(t, date)) return morning.get(t.id)!
      changed.add(t.id)
      return withState(t, stateAt(t, nextDay), nextDay)
    })
    return { evening, morning, changed }
  }

  const isReported = (task: ForecastTask) => (activitiesOf.get(task.id) ?? []).some((a) => historyOf.has(a.id))

  return { onDate, stateAt, isReported }
}

/**
 * The forecast with every report up to the end of `date` (what the schedule's latest forecast shows),
 * and the reported start, finish and percent of each task that has daily reports. Tasks never reported
 * follow their plan when their stored percent says they progressed (their stored dates are not used).
 */
export function liveForecast(
  input: ReportedProgressInput & { links: ForecastLink[]; date: string; isWorkday?: IsWorkday }
): { forecast: Map<string, ForecastDates>; reported: Map<string, ReportedTaskState> } {
  const progress = reportedProgress(input)
  const { evening } = progress.onDate(input.date)
  const reported = new Map<string, ReportedTaskState>()
  for (const t of evening) {
    if (t.isSummary || !progress.isReported(t)) continue
    reported.set(t.id, { percent: t.percent, start: t.actualStart, finish: t.actualFinish })
  }
  const forecast = forecastSchedule({ tasks: evening, links: input.links, statusDate: input.date, isWorkday: input.isWorkday })
  return { forecast, reported }
}

/**
 * Each activity's window on each date: the forecast run with every other task's progress as reported up
 * to the end of that day (work left after a same-day report starts the next day) and the task's own
 * progress as reported before that day, so its target does not bend to its own report while its
 * predecessors' reports move it at once (see `reportedProgress` for how reports set a task's state).
 */
export function replayWindows(
  input: ReportedProgressInput & { links: ForecastLink[]; dates: string[]; isWorkday?: IsWorkday }
): WindowChange[] {
  const progress = reportedProgress(input)
  const rows: WindowChange[] = []
  for (const date of input.dates) {
    const { evening, morning, changed } = progress.onDate(date)
    const forecastWith = (tasks: ForecastTask[]) => forecastSchedule({ tasks, links: input.links, statusDate: date, isWorkday: input.isWorkday })
    const live = forecastWith(evening)
    const own = new Map<string, Map<string, ForecastDates>>()
    const windowOf = (taskId: string) => {
      if (!changed.has(taskId)) return live.get(taskId)
      if (!own.has(taskId)) own.set(taskId, forecastWith(evening.map((t) => (t.id === taskId ? morning.get(t.id)! : t))))
      return own.get(taskId)!.get(taskId)
    }
    for (const a of input.activities) {
      const window = a.taskId ? windowOf(a.taskId) : undefined
      if (window) rows.push({ from: date, activityId: a.id, start: window.start, finish: window.finish })
    }
  }
  return rows
}
