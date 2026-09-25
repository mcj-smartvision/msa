import { getLatestProgressForActivity, type DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'

/** Local report wins on the same activity and date; otherwise both histories stay. */
export function mergeSupervisorProgressEntries(
  saved: DailyProgressEntry[],
  local: DailyProgressEntry[]
): DailyProgressEntry[] {
  const map = new Map<string, DailyProgressEntry>()
  for (const entry of [...saved, ...local]) {
    const date = entry.reportDate.slice(0, 10)
    if (!date || !entry.activityId) continue
    map.set(`${entry.activityId}@${date}`, { ...entry, reportDate: date })
  }
  return [...map.values()]
}

/** Stored physical percent on a schedule activity (ویرایش برنامه زمانبندی). */
export function schedulePhysicalPercent(task: {
  physical_percent_complete?: number | null
  percent_complete?: number | null
} | null | undefined): number | null {
  if (!task) return null
  const physical = task.physical_percent_complete
  if (physical != null && Number.isFinite(Number(physical))) return Number(physical)
  const pct = task.percent_complete
  if (pct != null && Number.isFinite(Number(pct))) return Number(pct)
  return null
}

/**
 * Same number the schedule editor shows: the latest site-supervisor report
 * when one exists, otherwise the percent stored on the activity.
 */
export function resolvePhysicalProgressPercent(
  activityId: string | null | undefined,
  fallback: number | null | undefined,
  entries: DailyProgressEntry[]
): number | null {
  if (activityId) {
    const latest = getLatestProgressForActivity(activityId, entries)
    if (latest && Number.isFinite(latest.percentComplete)) {
      return latest.percentComplete
    }
  }
  if (fallback == null || !Number.isFinite(Number(fallback))) return null
  return Number(fallback)
}
