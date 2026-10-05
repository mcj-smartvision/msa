import { taskBaselineDates } from '@/lib/schedule/leaf-activities'
import { plannedPercentInWindow } from '@/lib/schedule/planned-progress'
import { compareWbs } from '@/lib/schedule/wbs-utils'
import { normalizeScheduleWeightPercent, weightedProgressPercent } from '@/lib/schedule/weighted-progress'
import { logWeightIssues, resolveSiblingWeights, type WeightIssue } from '@/lib/schedule/weight-consistency'
import { WORKSHOP_SKIP_PM_APPROVAL } from '@/lib/workshop/approvals'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/lib/workshop/types'

export type DailyReportActivity = {
  id: string
  name: string
  wbs: string | null
  kind: 'schedule' | 'package'
  plannedStartDate: string
  plannedFinishDate: string | null
  /** Frozen baseline window that drives planned progress; the planned dates above drive today's work list. */
  baselineStartDate?: string | null
  baselineFinishDate?: string | null
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
  /** Cumulative percent of the activity at the end of `reportDate`. */
  percentComplete: number
  /** Progress gained that day: the rise over the previous report's cumulative. */
  dailyIncrement?: number
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

/** The activity's frozen baseline window (planned dates for legacy rows), else the tree dates. */
function nodeBaselineWindow(node: ScheduleTreeNode): { start: string | null; finish: string | null } {
  if (node.task) {
    const dates = taskBaselineDates(node.task as unknown as Record<string, unknown>)
    if (dates.start || dates.finish) return dates
  }
  return { start: isoDay(node.startDate), finish: isoDay(node.finishDate) }
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

function walkPackages(
  packages: WorkshopPackageNode[],
  parentStart: string | null,
  parentFinish: string | null,
  parentTaskName: string | null,
  parentTaskWbs: string | null,
  parentTaskId: string | null,
  /** Absolute weight of the parent (MSP task or parent package). */
  parentWeight: number | null | undefined,
  out: DailyReportActivity[],
  parentBaselinePercent = 0,
  parentBaseline: { start: string | null; finish: string | null } = { start: parentStart, finish: parentFinish },
  weightIssues: WeightIssue[] = []
) {
  const reportable = packages.filter(packageReportable)
  const { weights, issue } = resolveSiblingWeights(
    normalizeScheduleWeightPercent(parentWeight),
    reportable.map((pkg) => pkg.weightPercent),
    { id: parentTaskId, label: parentTaskName }
  )
  if (issue) weightIssues.push(issue)

  reportable.forEach((pkg, index) => {
    const progressWeight = weights[index] ?? 0
    const reportableChildren = pkg.children.filter(packageReportable)
    if (reportableChildren.length > 0) {
      walkPackages(
        reportableChildren,
        parentStart,
        parentFinish,
        parentTaskName,
        parentTaskWbs,
        parentTaskId,
        progressWeight,
        out,
        parentBaselinePercent,
        parentBaseline,
        weightIssues
      )
      return
    }
    const start = isoDay(parentStart) ?? ''
    const finish = isoDay(parentFinish)
    const quantity = effectivePackageQuantity(pkg)
    out.push({
      id: `package:${pkg.id}`,
      name: pkg.name,
      wbs: pkg.wbs,
      kind: 'package',
      plannedStartDate: start,
      plannedFinishDate: finish,
      baselineStartDate: isoDay(parentBaseline.start),
      baselineFinishDate: isoDay(parentBaseline.finish),
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
  })
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
  const weightIssues: WeightIssue[] = []

  for (const node of nodes) {
    const packages = node.packages ?? []
    if (node.taskId && packages.length) {
      walkPackages(
        packages.filter(packageReportable),
        node.startDate,
        node.finishDate,
        node.name,
        node.wbs,
        node.taskId,
        node.scheduleWeight,
        out,
        clampPercent(node.percentComplete ?? 0),
        nodeBaselineWindow(node),
        weightIssues
      )
    }

    if (shouldAddScheduleFallback(node, nodes)) {
      const progressWeight = normalizeScheduleWeightPercent(node.scheduleWeight) || 1
      const baseline = nodeBaselineWindow(node)
      out.push({
        id: `schedule:${node.taskId}`,
        name: node.name,
        wbs: node.wbs,
        kind: 'schedule',
        plannedStartDate: isoDay(node.startDate) ?? '',
        plannedFinishDate: isoDay(node.finishDate),
        baselineStartDate: baseline.start,
        baselineFinishDate: baseline.finish,
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
  logWeightIssues('daily-report-activities', weightIssues)

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

    const baseline = nodeBaselineWindow(node)
    out.push({
      id: `schedule:${node.taskId}`,
      name: node.name,
      wbs: node.wbs,
      kind: 'schedule',
      plannedStartDate: isoDay(node.startDate) ?? '',
      plannedFinishDate: isoDay(node.finishDate),
      baselineStartDate: baseline.start,
      baselineFinishDate: baseline.finish,
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

/**
 * Daily-report rows use prefixed ids (`schedule:uuid` / `package:uuid`).
 * Schedule EDIT/SEND look up by raw uuid — accept either form.
 */
export function dailyReportActivityLookupIds(activityId: string): string[] {
  const id = String(activityId ?? '').trim()
  if (!id) return []
  const ids = new Set<string>([id])
  if (id.startsWith('schedule:')) {
    ids.add(id.slice('schedule:'.length))
  } else if (id.startsWith('package:')) {
    ids.add(id.slice('package:'.length))
  } else {
    ids.add(`schedule:${id}`)
    ids.add(`package:${id}`)
  }
  return [...ids]
}

export function parseDailyReportActivityRef(activityId: string): {
  kind: 'schedule' | 'package' | 'unknown'
  entityId: string
} {
  const id = String(activityId ?? '').trim()
  if (id.startsWith('schedule:')) {
    return { kind: 'schedule', entityId: id.slice('schedule:'.length) }
  }
  if (id.startsWith('package:')) {
    return { kind: 'package', entityId: id.slice('package:'.length) }
  }
  return { kind: 'unknown', entityId: id }
}

export function getLatestProgressForActivity(
  activityId: string,
  entries: DailyProgressEntry[],
  beforeDate?: string
): DailyProgressEntry | null {
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  const pool = entries.filter((e) => {
    if (!keys.has(e.activityId)) return false
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
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  const pool = entries.filter((e) => keys.has(e.activityId) && e.reportDate <= asOfDate)
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
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  return entries.some((e) => keys.has(e.activityId) && e.reportDate === reportDate)
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

function isActivityCompleteForUnlock(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  reportDate: string
): boolean {
  const reported = latestReportedPercentForActivity(activity, entries, reportDate)
  const baseline = activity.baselinePercentComplete ?? 0
  return Math.max(reported, baseline) >= 100
}

/**
 * Immediate prior wave: activities that share the latest planned start strictly
 * before this activity. Completing that wave unlocks the next schedule window early.
 */
export function immediatePriorStartCohort(
  activity: DailyReportActivity,
  activities: DailyReportActivity[]
): DailyReportActivity[] {
  const start = activity.plannedStartDate
  if (!start) return []

  let latestPriorStart: string | null = null
  for (const other of activities) {
    if (other.id === activity.id) continue
    if (!other.plannedStartDate || other.plannedStartDate >= start) continue
    if (!latestPriorStart || other.plannedStartDate > latestPriorStart) {
      latestPriorStart = other.plannedStartDate
    }
  }
  if (!latestPriorStart) return []

  return activities.filter(
    (other) => other.id !== activity.id && other.plannedStartDate === latestPriorStart
  )
}

/** True when the previous schedule wave is fully done — unlock early start. */
export function isUnlockedEarlyByCompletedPriors(
  activity: DailyReportActivity,
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): boolean {
  if (!activity.plannedStartDate || activity.plannedStartDate <= reportDate) return false
  const priors = immediatePriorStartCohort(activity, activities)
  if (priors.length === 0) return false
  return priors.every((prior) => isActivityCompleteForUnlock(prior, entries, reportDate))
}

/** Classify activity relative to today's report date */
export function classifyDailyReportTiming(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  reportDate: string,
  activities: DailyReportActivity[] = []
): DailyReportTiming {
  // Planned start not reached — future unless prior wave finished early
  if (activity.plannedStartDate && activity.plannedStartDate > reportDate) {
    if (isUnlockedEarlyByCompletedPriors(activity, activities, entries, reportDate)) {
      return 'current'
    }
    return 'upcoming'
  }

  if (isActivityScheduledOnDate(activity, reportDate)) return 'current'

  if (activity.plannedFinishDate && reportDate > activity.plannedFinishDate) return 'past'
  if (!activity.plannedStartDate) return 'past'
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

/**
 * Incomplete work relevant to the report date (today window + overdue).
 * Future starts stay hidden unless the previous schedule wave is already 100%.
 */
export function activitiesEligibleForDailyReport(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): DailyReportActivity[] {
  return activities.filter((a) =>
    isDateRelevantIncompleteActivity(a, entries, reportDate, activities)
  )
}

/**
 * Daily-report visibility:
 * - upcoming (start > today): hidden, unless prior start-wave is fully complete
 *   and this activity itself is still incomplete
 * - current (start ≤ today ≤ finish): show until workshop report reaches 100%
 *   (MSP baseline alone must not hide current work — supervisor still enters %)
 * - past (finish < today): show only if still incomplete (report or MSP baseline < 100)
 * - never show past-finish activities that are already 100%
 */
function isDateRelevantIncompleteActivity(
  activity: DailyReportActivity,
  entries: DailyProgressEntry[],
  reportDate: string,
  allActivities: DailyReportActivity[]
): boolean {
  const start = activity.plannedStartDate || null
  const finish = activity.plannedFinishDate || null

  const reported = latestReportedPercentForActivity(activity, entries, reportDate)
  if (reported >= 100) return false

  const baseline = activity.baselinePercentComplete ?? 0
  const alreadyComplete = Math.max(reported, baseline) >= 100

  // Finish date passed and work already complete — never list for daily entry
  if (finish && finish < reportDate && alreadyComplete) return false

  // Start date not reached — show only when previous wave finished and this row is still open
  if (start && start > reportDate) {
    if (alreadyComplete) return false
    return isUnlockedEarlyByCompletedPriors(activity, allActivities, entries, reportDate)
  }

  const inCurrentWindow =
    Boolean(start) &&
    start! <= reportDate &&
    (!finish || finish >= reportDate)

  if (inCurrentWindow) {
    // Current schedule window: visible for progress entry even if MSP says 100%
    return true
  }

  if (!start && !finish) {
    // Orphan packages without dates: allow until reported or baseline 100%
    return activity.kind === 'package' && !alreadyComplete
  }

  // Past / overdue: hide when MSP or workshop already shows complete
  if (alreadyComplete) return false

  // Overdue: started, planned finish passed, still incomplete
  if (start && start <= reportDate && finish && finish < reportDate) return true

  // Started with no finish date (treat as still open)
  if (start && start <= reportDate && !finish) return true

  return false
}

export function partitionEligibleByTiming(
  activities: DailyReportActivity[],
  entries: DailyProgressEntry[],
  reportDate: string
): Record<DailyReportTiming, DailyReportActivity[]> {
  const buckets: Record<DailyReportTiming, DailyReportActivity[]> = {
    current: [],
    past: [],
    upcoming: [],
  }

  for (const activity of activities) {
    if (!isDateRelevantIncompleteActivity(activity, entries, reportDate, activities)) continue

    const timing = classifyDailyReportTiming(activity, entries, reportDate, activities)
    if (timing === 'upcoming') continue
    buckets[timing].push(activity)
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
  const hasBaseline = Boolean(activity.baselineStartDate || activity.baselineFinishDate)
  return plannedPercentInWindow(
    hasBaseline
      ? { start: activity.baselineStartDate, finish: activity.baselineFinishDate }
      : { start: activity.plannedStartDate || null, finish: activity.plannedFinishDate },
    asOfDate
  )
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
  /** null after last workshop report — chart stops drawing Actual there */
  actual: number | null
  planned: number
}

/** Latest workshop report day within [startDate, endDate], if any. */
export function latestWorkshopReportDateInRange(
  entries: DailyProgressEntry[],
  startDate: string,
  endDate: string
): string | null {
  let latest: string | null = null
  for (const e of entries) {
    if (e.reportDate < startDate || e.reportDate > endDate) continue
    if (!latest || e.reportDate > latest) latest = e.reportDate
  }
  return latest
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
 * Full-project S-curve: schedule day-1 → today (planned).
 * Actual Progress is drawn only through the last workshop report date
 * (null afterward so the chart line stops). With no reports yet, MSP-phased
 * actual still fills the full range as a fallback.
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
  const lastReportDate = latestWorkshopReportDateInRange(entries, startDate, end)

  return sampleDates.map((iso) => {
    const pastLastReport = Boolean(lastReportDate && iso > lastReportDate)
    return {
      date: iso,
      label: chartDateLabelFa(iso),
      actual: pastLastReport
        ? null
        : calculateSCurveActualProgress(
            activities,
            entries,
            iso,
            endDate,
            packageRows
          ),
      planned: calculatePlannedProjectProgress(activities, iso),
    }
  })
}

export function activityNeverReported(
  activityId: string,
  entries: DailyProgressEntry[]
): boolean {
  return !entries.some((e) => e.activityId === activityId)
}
