import type { DailyReportActivity } from '@/lib/supervisor/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'

export interface ProgressLedgerRow {
  key: string
  wbs: string | null
  name: string
  depth: number
  /** Daily-report activity id (`schedule:` / `package:`); null for heading rows that roll up their children. */
  activityId: string | null
  /** Schedule percent of the row (used for headings and never-reported activities). */
  schedulePercent: number | null
  startDate: string | null
  finishDate: string | null
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

  const addPackages = (packages: WorkshopPackageNode[], depth: number, start: string | null, finish: string | null) => {
    for (const pkg of packages) {
      const id = `package:${pkg.id}`
      const pkgStart = day(pkg.startDate) ?? start
      const pkgFinish = day(pkg.finishDate) ?? finish
      rows.push({
        key: id,
        wbs: pkg.wbs,
        name: pkg.name,
        depth,
        activityId: reportable.has(id) ? id : null,
        schedulePercent: null,
        startDate: pkgStart,
        finishDate: pkgFinish,
      })
      addPackages(pkg.children ?? [], depth + 1, pkgStart, pkgFinish)
    }
  }

  for (const node of nodes) {
    const id = node.taskId ? `schedule:${node.taskId}` : null
    rows.push({
      key: id ?? `group:${node.id}`,
      wbs: node.wbs,
      name: node.name,
      depth: node.depth,
      activityId: id && reportable.has(id) ? id : null,
      schedulePercent: node.percentComplete ?? null,
      startDate: day(node.startDate),
      finishDate: day(node.finishDate),
    })
    addPackages(node.packages ?? [], node.depth + 1, day(node.startDate), day(node.finishDate))
  }

  if (orphanPackages.length) {
    rows.push({
      key: 'group:orphans',
      wbs: null,
      name: 'زیرشاخه‌های بدون فعالیت والد',
      depth: 0,
      activityId: null,
      schedulePercent: null,
      startDate: null,
      finishDate: null,
    })
    addPackages(orphanPackages, 1, null, null)
  }
  return rows
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
