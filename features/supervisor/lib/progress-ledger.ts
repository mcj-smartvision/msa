import type { DailyReportActivity } from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'

export interface ProgressLedgerRow {
  key: string
  wbs: string | null
  name: string
  depth: number
  /** Daily-report activity id (`schedule:` / `package:`); null for heading rows that roll up their children. */
  activityId: string | null
  /** Schedule percent of the row (used for headings and never-reported activities). */
  schedulePercent: number | null
  /** MSP weight of schedule rows (null for workshop sub-items); drives the heading rollup. */
  scheduleWeight: number | null
  /** Latest schedule, moved by the progress forecast. */
  startDate: string | null
  finishDate: string | null
  /** Approved plan (start_planned / finish_planned) the forecast is compared with. */
  approvedStartDate: string | null
  approvedFinishDate: string | null
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null)

/**
 * Rows of the daily-report ledger in schedule order: every task of the latest schedule, with its
 * workshop sub-items under it. Rows that the daily report collects progress for are editable.
 */
export function buildProgressLedgerRows(
  nodes: ScheduleTreeNode[],
  orphanPackages: WorkshopPackageNode[],
  activities: DailyReportActivity[]
): ProgressLedgerRow[] {
  const reportable = new Set(activities.map((a) => a.id))
  const rows: ProgressLedgerRow[] = []

  type Window = { start: string | null; finish: string | null }
  const addPackages = (packages: WorkshopPackageNode[], depth: number, current: Window, approved: Window) => {
    for (const pkg of packages) {
      const id = `package:${pkg.id}`
      const own = day(pkg.startDate) != null
      const pkgCurrent = { start: day(pkg.startDate) ?? current.start, finish: day(pkg.finishDate) ?? current.finish }
      const pkgApproved = own ? pkgCurrent : approved
      rows.push({
        key: id,
        wbs: pkg.wbs,
        name: pkg.name,
        depth,
        activityId: reportable.has(id) ? id : null,
        schedulePercent: null,
        scheduleWeight: null,
        startDate: pkgCurrent.start,
        finishDate: pkgCurrent.finish,
        approvedStartDate: pkgApproved.start,
        approvedFinishDate: pkgApproved.finish,
      })
      addPackages(pkg.children ?? [], depth + 1, pkgCurrent, pkgApproved)
    }
  }

  for (const node of nodes) {
    const id = node.taskId ? `schedule:${node.taskId}` : null
    const current = { start: day(node.startDate), finish: day(node.finishDate) }
    const approved = {
      start: day(node.task?.start_planned) ?? current.start,
      finish: day(node.task?.finish_planned) ?? current.finish,
    }
    rows.push({
      key: id ?? `group:${node.id}`,
      wbs: node.wbs,
      name: node.name,
      depth: node.depth,
      activityId: id && reportable.has(id) ? id : null,
      schedulePercent: node.percentComplete ?? null,
      scheduleWeight: node.scheduleWeight ?? null,
      startDate: current.start,
      finishDate: current.finish,
      approvedStartDate: approved.start,
      approvedFinishDate: approved.finish,
    })
    addPackages(node.packages ?? [], node.depth + 1, current, approved)
  }

  if (orphanPackages.length) {
    rows.push({
      key: 'group:orphans',
      wbs: null,
      name: 'زیرشاخه‌های بدون فعالیت والد',
      depth: 0,
      activityId: null,
      schedulePercent: null,
      scheduleWeight: null,
      startDate: null,
      finishDate: null,
      approvedStartDate: null,
      approvedFinishDate: null,
    })
    addPackages(orphanPackages, 1, { start: null, finish: null }, { start: null, finish: null })
  }
  return rows
}

/** Site week is Saturday–Thursday; Friday is the day off. */
export const isSiteWorkday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() !== 5

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Working days (Saturday–Thursday unless `isWorkday` says otherwise) from planned start to finish, inclusive. */
export function plannedWorkdays(
  startDate: string | null,
  finishDate: string | null,
  isWorkday: (iso: string) => boolean = isSiteWorkday
): number {
  if (!startDate || !finishDate || finishDate < startDate) return 0
  let workdays = 0
  for (let d = startDate; d <= finishDate; d = nextDay(d)) if (isWorkday(d)) workdays++
  return workdays
}

export interface PlannedDay {
  /** Required progress per working day: 100 divided by the activity's planned working days. */
  daily: number
  /** Required cumulative percent by the end of this day; 100 on the last working day. */
  cumulative: number
}

/**
 * Required progress counted from `firstDate`: on each of the next `workdays` working days the cumulative
 * rises by 100 / `workdays`, reaching 100 on the last one.
 */
export function plannedProgressFrom(
  firstDate: string,
  workdays: number,
  isWorkday: (iso: string) => boolean = isSiteWorkday
): Map<string, PlannedDay> {
  const out = new Map<string, PlannedDay>()
  if (workdays <= 0) return out
  const daily = Math.round(10000 / workdays) / 100
  let k = 0
  for (let d = firstDate; k < workdays; d = nextDay(d)) {
    if (!isWorkday(d)) continue
    k++
    out.set(d, { daily, cumulative: k === workdays ? 100 : Math.round((10000 * k) / workdays) / 100 })
  }
  return out
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * Calendar days the forecast moved a row against the approved plan (positive = later): its start
 * while that is still ahead of `today`, else its finish. Null when unmoved or undated.
 */
export function forecastShift(
  row: Pick<ProgressLedgerRow, 'startDate' | 'finishDate' | 'approvedStartDate' | 'approvedFinishDate'>,
  today: string
): { days: number; of: 'start' | 'finish' } | null {
  const notStarted = row.startDate != null && row.startDate > today
  const [planned, forecast] = notStarted
    ? [row.approvedStartDate, row.startDate]
    : [row.approvedFinishDate, row.finishDate]
  if (!planned || !forecast) return null
  const days = dayDiff(planned, forecast)
  return days === 0 ? null : { days, of: notStarted ? 'start' : 'finish' }
}

/**
 * How many calendar days after its approved start an activity began: from its first reported progress,
 * else (not begun yet) from the forecast start. Null when it began on time or early.
 */
export function startDelay(
  row: Pick<ProgressLedgerRow, 'startDate' | 'approvedStartDate'>,
  firstReported: string | null
): { days: number; started: boolean } | null {
  if (!row.approvedStartDate) return null
  const begun = firstReported ?? row.startDate
  if (!begun) return null
  const days = dayDiff(row.approvedStartDate, begun)
  return days > 0 ? { days, started: firstReported != null } : null
}

/**
 * Required progress when the commitment window changes over time: each segment's window drives the
 * days from its `from` date until the next segment begins (`from: null` = before the first change).
 */
export function segmentedPlannedProgress(
  segments: { from: string | null; window: { start: string | null; finish: string | null } }[],
  isWorkday: (iso: string) => boolean = isSiteWorkday
): Map<string, PlannedDay> {
  const out = new Map<string, PlannedDay>()
  segments.forEach((segment, i) => {
    const { start, finish } = segment.window
    if (!start) return
    const until = segments[i + 1]?.from ?? null
    for (const [d, planned] of plannedProgressFrom(start, plannedWorkdays(start, finish, isWorkday), isWorkday)) {
      if (segment.from && d < segment.from) continue
      if (until && d >= until) continue
      out.set(d, planned)
    }
  })
  return out
}

/** First and last project day from the schedule rows, widened to cover `extraDates` (reports, today). */
export function ledgerDateRange(rows: ProgressLedgerRow[], extraDates: string[]): { from: string; to: string } | null {
  const dates = [
    ...rows.flatMap((r) => [r.startDate, r.finishDate]).filter((d): d is string => !!d),
    ...extraDates,
  ].sort()
  if (dates.length === 0) return null
  return { from: dates[0]!, to: dates[dates.length - 1]! }
}
