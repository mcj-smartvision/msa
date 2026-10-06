import { addDaysIso, diffDaysIso, toIsoDateOnly } from '@/features/schedule/lib/dates'
import {
getImmutableBaselineDates,
ScheduleRebuildError,
} from '@/features/schedule/lib/baseline-template'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import type { ProjectTask } from '@/shared/types/schedule'

export interface RescheduledTaskDates {
  start: string
  finish: string
}

export interface FlatShiftScheduleResult {
  taskDates: Map<string, RescheduledTaskDates>
  /** Selected actual project start (YYYY-MM-DD). */
  actualStart: string
  /** Immutable MSP project baseline start (YYYY-MM-DD). */
  projectBaselineStart: string
  /** Calendar days added to every baseline date (actualStart − anchorStart). */
  deltaDays: number
  /** WBS used to anchor task 1.1 on actualStart. */
  anchorWbs: string | null
}

function toTimestamp(isoDate: string): string {
  return `${isoDate}T12:00:00.000Z`
}

/** Prefer WBS 1.1 so it lands exactly on the selected actual start. */
export function findScheduleAnchorTask(tasks: ProjectTask[]): ProjectTask | null {
  const sorted = [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))
  const exact = sorted.find((t) => t.wbs_code === '1.1')
  if (exact) return exact
  const prefixed = sorted.find((t) => t.wbs_code?.startsWith('1.1'))
  if (prefixed) return prefixed
  return sorted[0] ?? null
}

/**
 * Global flat reschedule:
 *   delta = ActualStart − AnchorBaselineStart  (anchor = WBS 1.1, else project baseline)
 *   NewStart  = OriginalBaselineStart  + delta
 *   NewFinish = OriginalBaselineFinish + delta
 *
 * Always reads immutable baseline_* — never shifted planned dates (no cumulative error).
 */
export function shiftScheduleByActualStart(
  actualStartIso: string,
  tasks: ProjectTask[],
  projectBaselineStartIso: string
): FlatShiftScheduleResult {
  if (!tasks.length) {
    throw new ScheduleRebuildError('No tasks to reschedule.')
  }

  const actualStart = toIsoDateOnly(actualStartIso)
  const projectBaselineStart = toIsoDateOnly(projectBaselineStartIso)

  if (!actualStart || !projectBaselineStart) {
    throw new ScheduleRebuildError('Actual start and project baseline start must be valid dates.')
  }

  const anchorTask = findScheduleAnchorTask(tasks)
  const anchorBaseline = anchorTask
    ? getImmutableBaselineDates(anchorTask).start
    : projectBaselineStart

  /** Delta in whole calendar days: positive moves schedule forward. */
  const deltaDays = diffDaysIso(anchorBaseline, actualStart)

  const taskDates = new Map<string, RescheduledTaskDates>()

  for (const task of tasks) {
    const baseline = getImmutableBaselineDates(task)
    const originalDuration = diffDaysIso(baseline.start, baseline.finish)

    const newStart = addDaysIso(baseline.start, deltaDays)
    const newFinish = addDaysIso(baseline.finish, deltaDays)
    const newDuration = diffDaysIso(newStart, newFinish)

    if (originalDuration !== newDuration) {
      throw new ScheduleRebuildError(
        `Duration changed for task "${task.name}" after shift — baseline data may be corrupt. Re-import MSP XML.`
      )
    }

    taskDates.set(task.id, {
      start: toTimestamp(newStart),
      finish: toTimestamp(newFinish),
    })
  }

  if (anchorTask) {
    const anchorShifted = taskDates.get(anchorTask.id)
    const anchorStart = toIsoDateOnly(anchorShifted?.start)
    if (anchorStart !== actualStart) {
      throw new ScheduleRebuildError(
        `Anchor task ${anchorTask.wbs_code ?? '?'} did not land on actual start (${actualStart}). Re-import MSP XML.`
      )
    }
  }

  return {
    taskDates,
    actualStart,
    projectBaselineStart,
    deltaDays,
    anchorWbs: anchorTask?.wbs_code ?? null,
  }
}

/** @deprecated Use shiftScheduleByActualStart — flat delta shift, not CPM rebuild. */
export function rebuildScheduleFromProjectStart(
  actualStartIso: string,
  tasks: ProjectTask[],
  _dependencies: unknown,
  projectBaselineStartIso: string
) {
  const result = shiftScheduleByActualStart(actualStartIso, tasks, projectBaselineStartIso)
  return {
    taskDates: result.taskDates,
    projectStart: result.actualStart,
    baselineStart: result.projectBaselineStart,
  }
}

export function taskDurationDays(start: string, finish: string): number {
  return Math.max(1, diffDaysIso(start, finish) + 1)
}

export { toTimestamp }
