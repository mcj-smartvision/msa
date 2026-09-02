import { compareWbs } from '@/lib/schedule/wbs-utils'
import {
  normalizeScheduleWeightPercent,
  packageProgressWeight,
  weightedProgressPercent,
} from '@/lib/schedule/weighted-progress'
import { WORKSHOP_SKIP_PM_APPROVAL } from '@/lib/workshop/approvals'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'

export type DailyReportActivity = {
  id: string
  name: string
  wbs: string | null
  kind: 'schedule' | 'package'
  plannedStartDate: string
  plannedFinishDate: string | null
  /** Weight for project progress (percent points — MSP وزن or package share) */
  progressWeight: number
  /** Legacy quantity/duration helper (not used for % rollup) */
  plannedDurationDays: number
  /** Workshop package quantity from technical office */
  quantity?: number
  uom?: string
  location?: string | null
  /** Parent MSP activity name when this row is a technical-office package */
  parentTaskName?: string | null
  /** Parent MSP activity WBS code */
  parentTaskWbs?: string | null
  /** Parent project_tasks.id for grouping */
  parentTaskId?: string | null
  /** MSP / catch-up percent when no supervisor daily entry exists yet */
  baselinePercentComplete?: number
}

export type DailyProgressEntry = {
  activityId: string
  reportDate: string
  percentComplete: number
  /** ISO timestamp when this row was saved (for history view) */
  savedAt?: string
}

function isoDay(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.slice(0, 10)
}

function packageReportable(pkg: WorkshopPackageNode): boolean {
  if (pkg.approvalStatus === 'rejected') return false
  if (
    !WORKSHOP_SKIP_PM_APPROVAL &&
    (pkg.approvalStatus === 'draft' || pkg.approvalStatus === 'pending_approval')
  ) {
    return false
  }
  return true
}

function effectivePackageQuantity(pkg: WorkshopPackageNode): number {
  const pending = pkg.pendingChange?.quantity
  if (pending != null && Number.isFinite(pending) && pending > 0) return pending
  return pkg.quantity > 0 ? pkg.quantity : 1
}

function effectivePackageUom(pkg: WorkshopPackageNode): string {
  const pending = pkg.pendingChange?.uom?.trim()
  if (pending) return pending
  return pkg.uom
}

function scheduleTaskWeight(node: ScheduleTreeNode): number {
  if (node.scheduleWeight != null && Number.isFinite(node.scheduleWeight) && node.scheduleWeight > 0) {
    return node.scheduleWeight * 100
  }
  const start = isoDay(node.startDate)
  const finish = isoDay(node.finishDate)
  if (start && finish) {
    const ms = new Date(`${finish}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()
    return Math.max(1, Math.round(ms / 86_400_000) + 1)
  }
  return 1
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function hasReportableLeafPackages(packages: WorkshopPackageNode[]): boolean {
  for (const pkg of packages) {
    if (!packageReportable(pkg)) continue
    const reportableChildren = pkg.children.filter(packageReportable)
    if (reportableChildren.length > 0) {
      if (hasReportableLeafPackages(reportableChildren)) return true
      continue
    }
    return true
  }
  return false
}

function isLeafWbsNode(node: ScheduleTreeNode, allNodes: ScheduleTreeNode[]): boolean {
  if (!node.wbs?.trim()) return true
  const prefix = `${node.wbs.trim()}.`
  return !allNodes.some((other) => other.id !== node.id && other.wbs?.startsWith(prefix))
}

function descendantTasksHaveReportablePackages(
  node: ScheduleTreeNode,
  allNodes: ScheduleTreeNode[]
): boolean {
  if (!node.wbs?.trim()) return false
  const prefix = `${node.wbs.trim()}.`
  return allNodes.some(
    (other) =>
      other.id !== node.id &&
      other.wbs?.startsWith(prefix) &&
      hasReportableLeafPackages(other.packages)
  )
}

function shouldAddScheduleFallback(node: ScheduleTreeNode, allNodes: ScheduleTreeNode[]): boolean {
  if (!node.taskId) return false
  if (hasReportableLeafPackages(node.packages ?? [])) return false
  if (descendantTasksHaveReportablePackages(node, allNodes)) return false
  if (!isLeafWbsNode(node, allNodes)) return false
  // Include completed (100%) leaves so overall / S-curve weight is correct
  return true
}

function countLeafReportablePackages(packages: WorkshopPackageNode[]): number {
  let count = 0
  for (const pkg of packages) {
    if (!packageReportable(pkg)) continue
    const reportableChildren = pkg.children.filter(packageReportable)
    if (reportableChildren.length > 0) {
      count += countLeafReportablePackages(reportableChildren)
      continue
    }
    count += 1
  }
  return count
}

function walkPackages(
  packages: WorkshopPackageNode[],
  parentStart: string | null,
  parentFinish: string | null,
  parentTaskName: string | null,
  parentTaskWbs: string | null,
  parentTaskId: string | null,
  parentScheduleWeight: number | null | undefined,
  leafSiblingCount: number,
  out: DailyReportActivity[],
  parentBaselinePercent = 0
) {
  for (const pkg of packages) {
    if (!packageReportable(pkg)) continue
    const reportableChildren = pkg.children.filter(packageReportable)
    if (reportableChildren.length > 0) {
      walkPackages(
        reportableChildren,
        parentStart,
        parentFinish,
        parentTaskName,
        parentTaskWbs,
        parentTaskId,
        parentScheduleWeight,
        leafSiblingCount,
        out,
        parentBaselinePercent
      )
      continue
    }
    const start = isoDay(parentStart) ?? ''
    const finish = isoDay(parentFinish)
    const quantity = effectivePackageQuantity(pkg)
    const progressWeight = packageProgressWeight(
      pkg.weightPercent,
      parentScheduleWeight,
      leafSiblingCount
    )
    out.push({
      id: `package:${pkg.id}`,
      name: pkg.name,
      wbs: pkg.wbs,
      kind: 'package',
      plannedStartDate: start,
      plannedFinishDate: finish,
      progressWeight,
      plannedDurationDays: quantity,
      quantity,
      uom: effectivePackageUom(pkg),
      location: pkg.pendingChange?.location ?? pkg.location,
      parentTaskName,
      parentTaskWbs,
      parentTaskId,
      baselinePercentComplete: parentBaselinePercent,
    })
  }
}

function walkOrphanPackages(
  packages: WorkshopPackageNode[],
  out: DailyReportActivity[]
) {
  for (const pkg of packages) {
    if (!packageReportable(pkg)) continue
    const reportableChildren = pkg.children.filter(packageReportable)
    if (reportableChildren.length > 0) {
      walkOrphanPackages(reportableChildren, out)
      continue
    }
    const quantity = effectivePackageQuantity(pkg)
    out.push({
      id: `package:${pkg.id}`,
      name: pkg.name,
      wbs: pkg.wbs,
      kind: 'package',
      plannedStartDate: '',
      plannedFinishDate: null,
      progressWeight: pkg.weightPercent != null && pkg.weightPercent > 0 ? pkg.weightPercent : 1,
      plannedDurationDays: quantity,
      quantity,
      uom: effectivePackageUom(pkg),
      location: pkg.pendingChange?.location ?? pkg.location,
      parentTaskName: 'زیرشاخه بدون فعالیت والد',
      parentTaskWbs: null,
      parentTaskId: null,
    })
  }
}

/** Reportable rows = workshop leaf packages + MSP leaf tasks without workshop breakdown */
export function buildDailyReportActivitiesFromTree(
  nodes: ScheduleTreeNode[],
  orphanPackages: WorkshopPackageNode[] = []
): DailyReportActivity[] {
  const out: DailyReportActivity[] = []

  for (const node of nodes) {
    const packages = node.packages ?? []
    if (node.taskId && packages.length) {
      const leafCount = countLeafReportablePackages(packages.filter(packageReportable))
      walkPackages(
        packages.filter(packageReportable),
        node.startDate,
        node.finishDate,
        node.name,
        node.wbs,
        node.taskId,
        node.scheduleWeight,
        leafCount,
        out,
        clampPercent(node.percentComplete ?? 0)
      )
    }

    if (shouldAddScheduleFallback(node, nodes)) {
      const progressWeight = normalizeScheduleWeightPercent(node.scheduleWeight) || 1
      out.push({
        id: `schedule:${node.taskId}`,
        name: node.name,
        wbs: node.wbs,
        kind: 'schedule',
        plannedStartDate: isoDay(node.startDate) ?? '',
        plannedFinishDate: isoDay(node.finishDate),
        progressWeight,
        plannedDurationDays: scheduleTaskWeight(node),
        parentTaskName: node.name,
        parentTaskWbs: node.wbs,
        parentTaskId: node.taskId,
        baselinePercentComplete: clampPercent(node.percentComplete ?? 0),
      })
    }
  }

  walkOrphanPackages(orphanPackages.filter(packageReportable), out)

  return out.sort((a, b) => compareWbs(a.wbs, b.wbs))
}

/**
 * S-curve / overall progress: one row per MSP leaf task (schedule weights + MSP %).
 * Workshop packages are not used as separate weights (avoids ignoring early completed work).
 */
export function buildSCurveActivitiesFromTree(nodes: ScheduleTreeNode[]): DailyReportActivity[] {
  const out: DailyReportActivity[] = []

  for (const node of nodes) {
    if (!node.taskId || node.isSyntheticGroup) continue
    if (!isLeafWbsNode(node, nodes)) continue

    out.push({
      id: `schedule:${node.taskId}`,
      name: node.name,
      wbs: node.wbs,
      kind: 'schedule',
      plannedStartDate: isoDay(node.startDate) ?? '',
      plannedFinishDate: isoDay(node.finishDate),
      progressWeight: normalizeScheduleWeightPercent(node.scheduleWeight) || 1,
      plannedDurationDays: scheduleTaskWeight(node),
      parentTaskName: node.name,
      parentTaskWbs: node.wbs,
      parentTaskId: node.taskId,
      baselinePercentComplete: clampPercent(node.percentComplete ?? 0),
    })
  }

  return out.sort((a, b) => compareWbs(a.wbs, b.wbs))
}

export function getLatestProgressForActivity(
  activityId: string,
  entries: DailyProgressEntry[],
  beforeDate?: string
): DailyProgressEntry | null {
  const pool = entries.filter((e) => {
    if (e.activityId !== activityId) return false
    if (beforeDate && e.reportDate >= beforeDate) return false
    return true
  })
  if (pool.length === 0) return null
  return pool.sort((a, b) => a.reportDate.localeCompare(b.reportDate)).at(-1) ?? null
}

export function latestPercentOnOrBefore(
  activityId: string,
  entries: DailyProgressEntry[],
  asOfDate: string,
  baselinePercent = 0
): number {
  const pool = entries.filter((e) => e.activityId === activityId && e.reportDate <= asOfDate)
  if (pool.length === 0) return baselinePercent
  return pool.sort((a, b) => a.reportDate.localeCompare(b.reportDate)).at(-1)!.percentComplete
}

export function latestPercentForActivity(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  asOfDate: string
): number {
  return latestPercentOnOrBefore(
    activity.id,
    entries,
    asOfDate,
    activity.baselinePercentComplete ?? 0
  )
}

/** Supervisor daily-report progress only (ignores MSP import baseline) */
export function latestReportedPercentForActivity(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  asOfDate: string
): number {
  return latestPercentOnOrBefore(activity.id, entries, asOfDate, 0)
}

export function hasEntryOnDate(
  activityId: string,
  reportDate: string,
  entries: DailyProgressEntry[]
): boolean {
  return entries.some((e) => e.activityId === activityId && e.reportDate === reportDate)
}

/** Activity window from MSP includes reportDate (start ≤ day ≤ finish) */
export function isActivityScheduledOnDate(
  activity: DailyReportActivity,
  reportDate: string
): boolean {
  if (!activity.plannedStartDate || activity.plannedStartDate > reportDate) return false
  if (activity.plannedFinishDate && reportDate > activity.plannedFinishDate) return false
  return true
}

export type DailyReportTiming = 'current' | 'past' | 'upcoming'

/** Classify activity relative to today's report date */
export function classifyDailyReportTiming(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  reportDate: string
): DailyReportTiming {
  const pct = latestPercentForActivity(activity, entries, reportDate)
  const hasProgress = pct > 0

  if (isActivityScheduledOnDate(activity, reportDate)) return 'current'

  // Work already started (report or MSP baseline) — not "future" even if MSP start is later
  if (hasProgress) {
    if (activity.plannedFinishDate && reportDate > activity.plannedFinishDate) return 'past'
    return 'current'
  }

  if (!activity.plannedStartDate) return 'past'
  if (activity.plannedStartDate > reportDate) return 'upcoming'
  return 'past'
}

export function dailyReportTimingLabel(timing: DailyReportTiming): string {
  if (timing === 'current') return 'ایام جاری'
  if (timing === 'past') return 'کار قبلی'
  return 'آینده'
}

/** Group reportable sub-branches under their parent MSP activity header */
export function groupDailyReportActivitiesByParent(
  activities: DailyReportActivity[]
): { key: string; parentTaskWbs: string | null; parentTaskName: string; activities: DailyReportActivity[] }[] {
  const groups = new Map<
    string,
    { parentTaskWbs: string | null; parentTaskName: string; activities: DailyReportActivity[] }
  >()

  for (const activity of activities) {
    const parentTaskName = activity.parentTaskName?.trim() || 'فعالیت برنامه'
    const key = activity.parentTaskId ?? activity.parentTaskWbs ?? parentTaskName
    const existing = groups.get(key)
    if (existing) {
      existing.activities.push(activity)
    } else {
      groups.set(key, {
        parentTaskWbs: activity.parentTaskWbs ?? null,
        parentTaskName,
        activities: [activity],
      })
    }
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    ...group,
    activities: group.activities.sort((a, b) => compareWbs(a.wbs, b.wbs)),
  }))
}

/** All workshop packages not yet at 100% progress (any schedule date) */
export function activitiesEligibleForDailyReport(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): DailyReportActivity[] {
  return activities.filter((a) => {
    const pct = latestPercentForActivity(a, entries, reportDate)
    return pct < 100
  })
}

export function partitionEligibleByTiming(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): Record<DailyReportTiming, DailyReportActivity[]> {
  const eligible = activitiesEligibleForDailyReport(activities, entries, reportDate)
  const buckets: Record<DailyReportTiming, DailyReportActivity[]> = {
    current: [],
    past: [],
    upcoming: [],
  }
  for (const activity of eligible) {
    buckets[classifyDailyReportTiming(activity, entries, reportDate)].push(activity)
  }
  for (const key of Object.keys(buckets) as DailyReportTiming[]) {
    buckets[key].sort((a, b) => compareWbs(a.wbs, b.wbs))
  }
  return buckets
}

export function countRemainingForTodayReport(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): number {
  const eligible = activitiesEligibleForDailyReport(activities, entries, reportDate)
  return eligible.filter((a) => !hasEntryOnDate(a.id, reportDate, entries)).length
}

export function calculateProjectProgress(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  asOfDate?: string
): number {
  if (activities.length === 0) return 0

  return weightedProgressPercent(
    activities.map((activity) => ({
      progress: asOfDate
        ? latestPercentForActivity(activity, entries, asOfDate)
        : latestPercentForActivity(activity, entries, '9999-12-31'),
      weight: activity.progressWeight,
    }))
  )
}

/** Weighted project progress from supervisor daily reports only (for KPI + chart) */
export function calculateReportedProjectProgress(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  asOfDate?: string
): number {
  if (activities.length === 0) return 0

  return weightedProgressPercent(
    activities.map((activity) => ({
      progress: asOfDate
        ? latestReportedPercentForActivity(activity, entries, asOfDate)
        : latestReportedPercentForActivity(activity, entries, '9999-12-31'),
      weight: activity.progressWeight,
    }))
  )
}

function linearPlannedPercentForActivity(
  activity: DailyReportActivity,
  asOfDate: string
): number {
  const start = activity.plannedStartDate
  const finish = activity.plannedFinishDate
  if (!start) return 0
  if (asOfDate < start) return 0
  if (!finish || finish <= start) return 100
  if (asOfDate >= finish) return 100
  const startMs = new Date(`${start}T12:00:00`).getTime()
  const finishMs = new Date(`${finish}T12:00:00`).getTime()
  const asOfMs = new Date(`${asOfDate}T12:00:00`).getTime()
  const total = Math.max(1, finishMs - startMs)
  const elapsed = Math.max(0, asOfMs - startMs)
  return Math.min(100, Math.round((elapsed / total) * 100))
}

/** Weighted planned progress from MSP activity date windows */
export function calculatePlannedProjectProgress(
  activities: DailyReportActivity[],
  asOfDate: string
): number {
  if (activities.length === 0) return 0

  return weightedProgressPercent(
    activities.map((activity) => ({
      progress: linearPlannedPercentForActivity(activity, asOfDate),
      weight: activity.progressWeight > 0 ? activity.progressWeight : 1,
    })),
    1,
    2
  )
}

export type ProjectProgressSeriesPoint = {
  date: string
  label: string
  actual: number
  planned: number
}

function chartDateLabelFa(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' })
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T12:00:00`).getTime()
  const b = new Date(`${endIso}T12:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** Earliest MSP start across the full schedule tree (day 1 of planning). */
export function earliestScheduleStartFromTree(nodes: ScheduleTreeNode[]): string | null {
  let start: string | null = null
  for (const node of nodes) {
    const day = isoDay(node.startDate)
    if (day && (!start || day < start)) start = day
  }
  return start
}

/**
 * S-curve range:
 * - start = day 1 of schedule (MSP), never the first report date
 * - end = today
 */
export function resolveProjectCurveDateRange(
  activities: DailyReportActivity[],
  endDate: string,
  scheduleStartDate?: string | null
): { startDate: string; endDate: string } {
  let start: string | null = scheduleStartDate?.slice(0, 10) || null

  if (!start) {
    for (const activity of activities) {
      if (activity.plannedStartDate && (!start || activity.plannedStartDate < start)) {
        start = activity.plannedStartDate
      }
    }
  }

  if (!start) start = endDate
  if (start > endDate) start = endDate
  return { startDate: start, endDate }
}

/**
 * Actual % for S-curve on a given day:
 * 1) supervisor reports under this MSP leaf (carry-forward)
 * 2) else phase MSP PercentComplete across the task's start→finish window
 *    so early completed work rises from day-1 of that activity (not a jump at finish)
 */
export function progressForSCurveAsOf(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  asOfDate: string,
  today: string,
  packageRows: DailyReportActivity[] = []
): number {
  const hasOwnReport = entries.some(
    (e) => e.activityId === activity.id && e.reportDate <= asOfDate
  )
  if (hasOwnReport) {
    return latestPercentOnOrBefore(activity.id, entries, asOfDate, 0)
  }

  // Roll up package reports under this MSP leaf (if any)
  if (activity.kind === 'schedule' && activity.parentTaskId) {
    const childPackages = packageRows.filter((p) => p.parentTaskId === activity.parentTaskId)
    const reportedChildren = childPackages.filter((p) =>
      entries.some((e) => e.activityId === p.id && e.reportDate <= asOfDate)
    )
    if (reportedChildren.length > 0) {
      return weightedProgressPercent(
        reportedChildren.map((p) => ({
          weight: p.progressWeight > 0 ? p.progressWeight : 1,
          progress: latestPercentOnOrBefore(p.id, entries, asOfDate, 0),
        })),
        1,
        2
      )
    }
  }

  const baseline = activity.baselinePercentComplete ?? 0
  if (baseline <= 0) return 0

  const planned = linearPlannedPercentForActivity(activity, asOfDate)

  // Today / KPI: show full imported MSP snapshot (catch-up status)
  if (asOfDate >= today) return baseline

  // History: phase baseline along the schedule window (not a jump at finish)
  return Math.round((planned / 100) * baseline * 100) / 100
}

export function calculateSCurveActualProgress(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  asOfDate: string,
  today: string,
  packageRows: DailyReportActivity[] = []
): number {
  if (activities.length === 0) return 0
  return weightedProgressPercent(
    activities.map((activity) => ({
      progress: progressForSCurveAsOf(activity, entries, asOfDate, today, packageRows),
      weight: activity.progressWeight > 0 ? activity.progressWeight : 1,
    })),
    1,
    2
  )
}

function collectCurveSampleDates(
  startDate: string,
  endDate: string,
  entries: DailyProgressEntry[],
  maxPoints: number
): string[] {
  const totalDays = daysBetweenInclusive(startDate, endDate)
  const mustKeep = new Set<string>([startDate, endDate])
  for (const e of entries) {
    if (e.reportDate >= startDate && e.reportDate <= endDate) mustKeep.add(e.reportDate)
  }

  if (totalDays + 1 <= maxPoints) {
    const all: string[] = []
    for (let i = 0; i <= totalDays; i++) all.push(addDaysIso(startDate, i))
    return all
  }

  const step = Math.ceil((totalDays + 1) / maxPoints)
  const sampled = new Set<string>()
  for (let i = 0; i <= totalDays; i += step) {
    sampled.add(addDaysIso(startDate, i))
  }
  sampled.add(endDate)
  for (const d of mustKeep) sampled.add(d)

  return [...sampled].sort((a, b) => a.localeCompare(b))
}

/**
 * Full-project S-curve: schedule day-1 → today.
 * Prefer MSP leaf activities (weights from برنامه); optional packageRows overlay supervisor reports.
 */
export function buildProjectProgressSeries(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  endDate: string,
  scheduleStartDate?: string | null,
  packageRows: DailyReportActivity[] = []
): ProjectProgressSeriesPoint[] {
  const { startDate, endDate: end } = resolveProjectCurveDateRange(
    activities,
    endDate,
    scheduleStartDate
  )
  const sampleDates = collectCurveSampleDates(startDate, end, entries, 120)

  return sampleDates.map((iso) => ({
    date: iso,
    label: chartDateLabelFa(iso),
    actual: calculateSCurveActualProgress(
      activities,
      entries,
      iso,
      endDate,
      packageRows
    ),
    planned: calculatePlannedProjectProgress(activities, iso),
  }))
}

export function activityNeverReported(
  activityId: string,
  entries: DailyProgressEntry[]
): boolean {
  return !entries.some((e) => e.activityId === activityId)
}
