import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import type { ProjectTask } from '@/shared/types/schedule'

export class ScheduleRebuildError extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'ScheduleRebuildError'
    this.details = details
  }
}

/** Immutable MSP template dates — never use shifted start_planned/finish_planned. */
export function getImmutableBaselineDates(task: ProjectTask): { start: string; finish: string } {
  const start = toIsoDateOnly(task.baseline_start)
  const finish = toIsoDateOnly(task.baseline_finish)

  if (!start || !finish) {
    throw new ScheduleRebuildError(
      `Task "${task.name}" (${task.wbs_code ?? task.id}) has no immutable baseline. Re-import the MSP XML schedule.`
    )
  }

  if (finish < start) {
    throw new ScheduleRebuildError(
      `Task "${task.name}" has invalid baseline dates (finish before start). Re-import the MSP XML schedule.`
    )
  }

  return { start, finish }
}

/** One-time snapshot of planned dates as baseline before the first reschedule. */
export function canSnapshotPlannedAsBaseline(task: ProjectTask): boolean {
  return Boolean(toIsoDateOnly(task.start_planned) && toIsoDateOnly(task.finish_planned))
}

export function snapshotPlannedAsBaseline(task: ProjectTask): {
  baseline_start: string
  baseline_finish: string
} {
  const baseline_start = task.start_planned
  const baseline_finish = task.finish_planned
  if (!baseline_start || !baseline_finish) {
    throw new ScheduleRebuildError(`Task "${task.name}" has no planned dates to snapshot as baseline.`)
  }
  return { baseline_start, baseline_finish }
}
