import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import type { ProjectTask } from '@/shared/types/schedule'

export type TaskScheduleStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue'

export function taskEffectiveStart(task: ProjectTask): string | null {
  return toIsoDateOnly(task.start_current ?? task.start_planned)
}

export function taskEffectiveFinish(task: ProjectTask): string | null {
  return toIsoDateOnly(task.finish_current ?? task.finish_planned)
}

/** Dates shown in schedule preview rows (planned preferred, same as ScheduleTaskRow). */
export function taskPreviewStart(task: ProjectTask): string | null {
  return toIsoDateOnly(task.start_planned ?? task.start_current)
}

export function taskPreviewFinish(task: ProjectTask): string | null {
  return toIsoDateOnly(task.finish_planned ?? task.finish_current)
}

/**
 * Chronological order for schedule preview:
 * start date → finish date → MSP UID → WBS. Missing dates sort last.
 */
export function compareTasksByScheduleDate(a: ProjectTask, b: ProjectTask): number {
  const aStart = taskPreviewStart(a)
  const bStart = taskPreviewStart(b)
  if (aStart && bStart && aStart !== bStart) return aStart.localeCompare(bStart)
  if (aStart && !bStart) return -1
  if (!aStart && bStart) return 1

  const aFinish = taskPreviewFinish(a)
  const bFinish = taskPreviewFinish(b)
  if (aFinish && bFinish && aFinish !== bFinish) return aFinish.localeCompare(bFinish)
  if (aFinish && !bFinish) return -1
  if (!aFinish && bFinish) return 1

  const aUid = a.msp_uid
  const bUid = b.msp_uid
  if (aUid != null && bUid != null && aUid !== bUid) return aUid - bUid

  return compareWbs(a.wbs_code, b.wbs_code)
}

export function sortTasksByScheduleDate(tasks: ProjectTask[]): ProjectTask[] {
  return [...tasks].sort(compareTasksByScheduleDate)
}

/**
 * Preview order: chronological, but every predecessor row appears before its successors.
 * Uses predecessor label strings ("1.2FS, 3.1SS+2d") when available.
 */
export function sortTasksForSchedulePreview(
  tasks: ProjectTask[],
  predecessorLabels?: Record<string, string> | null
): ProjectTask[] {
  if (!predecessorLabels || Object.keys(predecessorLabels).length === 0) {
    return sortTasksByScheduleDate(tasks)
  }

  // Lazy import avoided — parse inline via regex for graph edges
  const byWbs = new Map<string, ProjectTask>()
  for (const task of tasks) {
    if (task.wbs_code) byWbs.set(task.wbs_code, task)
  }
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const successors = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()
  for (const task of tasks) inDegree.set(task.id, 0)

  for (const task of tasks) {
    const label = predecessorLabels[task.id] ?? ''
    for (const match of label.matchAll(/(\d+(?:\.\d+)*)(?:FS|SS|FF|SF)/gi)) {
      const pred = byWbs.get(match[1]!)
      if (!pred || pred.id === task.id) continue
      let set = successors.get(pred.id)
      if (!set) {
        set = new Set()
        successors.set(pred.id, set)
      }
      if (set.has(task.id)) continue
      set.add(task.id)
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1)
    }
  }

  const ready = tasks
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .sort(compareTasksByScheduleDate)
  const result: ProjectTask[] = []
  const remaining = new Set(tasks.map((t) => t.id))

  while (ready.length > 0) {
    ready.sort(compareTasksByScheduleDate)
    const next = ready.shift()!
    if (!remaining.has(next.id)) continue
    remaining.delete(next.id)
    result.push(next)
    for (const sid of successors.get(next.id) ?? []) {
      const deg = (inDegree.get(sid) ?? 1) - 1
      inDegree.set(sid, deg)
      if (deg === 0) {
        const succ = byId.get(sid)
        if (succ && remaining.has(sid)) ready.push(succ)
      }
    }
  }

  const leftover = tasks.filter((t) => remaining.has(t.id)).sort(compareTasksByScheduleDate)
  return [...result, ...leftover]
}

export function todayIso(): string {
  return todayTehranIso()
}

/**
 * Dynamic task status based on timeline vs as-of date (defaults to today).
 * - not_started: start > asOf
 * - in_progress: asOf within [start, finish]
 * - overdue: finish < asOf and progress < 100%
 * - completed: progress >= 100%
 */
export function getTaskScheduleStatus(
  task: ProjectTask,
  asOfDate: string = todayIso()
): TaskScheduleStatus {
  const start = taskEffectiveStart(task)
  const finish = taskEffectiveFinish(task)
  const pct = Number(task.percent_complete)

  if (pct >= 100) return 'completed'
  if (start && asOfDate < start) return 'not_started'
  if (finish && asOfDate > finish) return 'overdue'
  if (start && finish && asOfDate >= start && asOfDate <= finish) return 'in_progress'
  if (start && asOfDate >= start) return 'in_progress'
  return 'not_started'
}

export const TASK_STATUS_LABELS: Record<
  TaskScheduleStatus,
  { en: string; fa: string }
> = {
  not_started: { en: 'Not Started', fa: 'شروع نشده' },
  in_progress: { en: 'In Progress', fa: 'در جریان' },
  completed: { en: 'Completed', fa: 'تمام شده' },
  overdue: { en: 'Overdue', fa: 'تأخیر' },
}

/** @deprecated use getTaskScheduleStatus */
export type TaskViewStatus = TaskScheduleStatus
export const getTaskViewStatus = getTaskScheduleStatus

export function filterTasksForViewDate(
  tasks: ProjectTask[],
  viewDateIso: string,
  mode: 'all' | 'relevant' = 'all'
): ProjectTask[] {
  if (mode === 'all') return tasks
  return tasks.filter((task) => {
    const status = getTaskScheduleStatus(task, viewDateIso)
    return status === 'in_progress' || status === 'overdue' || status === 'completed'
  })
}
