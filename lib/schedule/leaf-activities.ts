import { toIsoDateOnly } from '@/lib/schedule/dates'

type Row = Record<string, unknown>

/** Current dates first, then planned, then the frozen MSP baseline. */
export function taskCurrentDates(row: Row): { start: string | null; finish: string | null } {
  return {
    start: toIsoDateOnly(
      (row.start_current as string) ??
        (row.start_planned as string) ??
        (row.baseline_start as string) ??
        null
    ),
    finish: toIsoDateOnly(
      (row.finish_current as string) ??
        (row.finish_planned as string) ??
        (row.baseline_finish as string) ??
        null
    ),
  }
}

/** Frozen MSP baseline first (never shifted by reschedule), then planned. */
export function taskBaselineDates(row: Row): { start: string | null; finish: string | null } {
  return {
    start: toIsoDateOnly(
      (row.baseline_start as string) ?? (row.start_planned as string) ?? null
    ),
    finish: toIsoDateOnly(
      (row.baseline_finish as string) ?? (row.finish_planned as string) ?? null
    ),
  }
}

export function isLeafTask(row: Row, tasks: Row[], packages: Row[]): boolean {
  const id = String(row.id)
  if (row.is_summary) return false
  if (packages.some((pkg) => String(pkg.project_task_id ?? '') === id)) return false
  if (tasks.some((other) => String(other.parent_id ?? '') === id)) return false
  const wbs = String(row.wbs_code ?? '').trim()
  if (
    wbs &&
    tasks.some(
      (other) =>
        String(other.id) !== id && String(other.wbs_code ?? '').trim().startsWith(`${wbs}.`)
    )
  ) {
    return false
  }
  return true
}

export function isLeafPackage(row: Row, packages: Row[]): boolean {
  const id = String(row.id)
  return !packages.some((other) => String(other.parent_package_id ?? '') === id)
}
