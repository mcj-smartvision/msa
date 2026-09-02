import type {
  CpmResult,
  NormalizedSchedule,
  PhaseSummary,
  ProjectKpis,
  ScheduleAnalysisConfig,
  ScheduleTask,
} from '@/types/schedule-intelligence'
import { durationDaysFromMinutes } from '@/lib/schedule-intelligence/durationUtils'
import { compareWbs } from '@/lib/schedule/wbs-utils'

function leafTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  return tasks.filter((t) => !t.isSummary)
}

export function buildProjectKpis(
  schedule: NormalizedSchedule,
  cpm: CpmResult,
  config: ScheduleAnalysisConfig,
  allWarnings: { severity: string }[]
): ProjectKpis {
  const leaves = leafTasks(schedule.tasks)
  const summaries = schedule.tasks.filter((t) => t.isSummary)
  const milestones = leaves.filter((t) => t.durationMinutes === 0)

  const errorCount = allWarnings.filter((w) => w.severity === 'error').length
  const warnCount = allWarnings.filter((w) => w.severity === 'warning').length

  const floats = leaves
    .map((t) => t.totalFloatMinutes)
    .filter((v): v is number => v != null)

  const statusCounts = { notStarted: 0, inProgress: 0, completed: 0, unknown: 0 }
  for (const t of leaves) {
    if (t.status === 'not-started') statusCounts.notStarted++
    else if (t.status === 'in-progress') statusCounts.inProgress++
    else if (t.status === 'completed') statusCounts.completed++
    else statusCounts.unknown++
  }

  const relCounts = { fs: 0, ss: 0, ff: 0, sf: 0 }
  for (const d of schedule.dependencies) {
    if (d.type === 'FS') relCounts.fs++
    else if (d.type === 'SS') relCounts.ss++
    else if (d.type === 'FF') relCounts.ff++
    else relCounts.sf++
  }

  let openStart = 0
  let openFinish = 0
  for (const t of leaves) {
    if (t.predecessors.length === 0) openStart++
    if (t.successors.length === 0) openFinish++
  }

  const avgPct =
    leaves.length > 0
      ? leaves.reduce((s, t) => s + t.percentComplete, 0) / leaves.length
      : 0

  return {
    projectName: schedule.projectName,
    sourceFileName: schedule.sourceFileName,
    analysisDate: config.analysisDate,
    totalActivities: schedule.tasks.length,
    totalSummaryTasks: summaries.length,
    totalMilestones: milestones.length,
    totalLeafTasks: leaves.length,
    totalDependencies: schedule.dependencies.length,
    projectStart: schedule.projectStart,
    projectFinish: schedule.projectFinish,
    calculatedProjectDurationDays: cpm.projectDurationDays,
    calendarBasisMinutesPerDay: schedule.minutesPerDay,
    dataQualityStatus: errorCount > 0 ? 'errors' : warnCount > 0 ? 'warnings' : 'ok',
    notStartedCount: statusCounts.notStarted,
    inProgressCount: statusCounts.inProgress,
    completedCount: statusCounts.completed,
    unknownStatusCount: statusCounts.unknown,
    averagePercentComplete: Math.round(avgPct * 10) / 10,
    criticalCount: cpm.criticalUids.length,
    criticalityRatio: leaves.length > 0 ? cpm.criticalUids.length / leaves.length : 0,
    nearCriticalCount: cpm.nearCriticalUids.length,
    shortestFloatMinutes: floats.length ? Math.min(...floats) : null,
    averageTotalFloatMinutes:
      floats.length ? floats.reduce((a, b) => a + b, 0) / floats.length : null,
    negativeFloatCount: floats.filter((f) => f < 0).length,
    fsCount: relCounts.fs,
    ssCount: relCounts.ss,
    ffCount: relCounts.ff,
    sfCount: relCounts.sf,
    openStartCount: openStart,
    openFinishCount: openFinish,
    validationErrorCount: errorCount,
    validationWarningCount: warnCount,
    cycleCount: cpm.errors.some((e) => e.code === 'CYCLE_DETECTED') ? 1 : 0,
    sourceCpmMismatchCount: cpm.sourceMismatchCount,
  }
}

export function buildPhaseSummaries(
  schedule: NormalizedSchedule,
  config: ScheduleAnalysisConfig
): PhaseSummary[] {
  const summaries = schedule.tasks.filter((t) => t.isSummary)
  const leaves = leafTasks(schedule.tasks)
  const totalLeafDuration = leaves.reduce((s, t) => s + t.durationMinutes, 0)

  const phases: PhaseSummary[] = []

  for (const summary of summaries) {
    const prefix = summary.outlineNumber
    if (!prefix) continue
    const children = leaves.filter(
      (t) =>
        t.outlineNumber?.startsWith(prefix + '.') ||
        t.parentUid === summary.uid
    )
    if (children.length === 0) continue

    const totalDur = children.reduce((s, t) => s + t.durationMinutes, 0)
    const remaining = children.reduce(
      (s, t) => s + (t.calculatedRemainingMinutes ?? 0),
      0
    )
    const starts = children.map((t) => t.start).filter(Boolean) as string[]
    const finishes = children.map((t) => t.finish).filter(Boolean) as string[]
    const critical = children.filter((t) => t.calculatedCritical).length
    const nearCrit = children.filter((t) => t.nearCritical).length
    const floats = children
      .map((t) => t.totalFloatMinutes)
      .filter((v): v is number => v != null)
    const highRisk = children.filter(
      (t) => t.riskLevel === 'high' || t.riskLevel === 'very-high'
    ).length
    const avgPct =
      children.reduce((s, t) => s + t.percentComplete, 0) / children.length

    phases.push({
      wbs: summary.wbs ?? summary.outlineNumber ?? summary.uid,
      name: summary.name,
      activityCount: children.length,
      totalDurationMinutes: totalDur,
      remainingDurationMinutes: remaining,
      earliestStart: starts.length ? starts.sort()[0] : null,
      latestFinish: finishes.length ? finishes.sort().reverse()[0] : null,
      percentComplete: Math.round(avgPct),
      criticalCount: critical,
      nearCriticalCount: nearCrit,
      averageFloatMinutes: floats.length
        ? floats.reduce((a, b) => a + b, 0) / floats.length
        : null,
      highRiskCount: highRisk,
      durationSharePercent:
        totalLeafDuration > 0 ? Math.round((totalDur / totalLeafDuration) * 100) : 0,
    })
  }

  if (phases.length === 0 && leaves.length > 0) {
    phases.push({
      wbs: 'ALL',
      name: schedule.projectName ?? 'پروژه',
      activityCount: leaves.length,
      totalDurationMinutes: totalLeafDuration,
      remainingDurationMinutes: leaves.reduce(
        (s, t) => s + (t.calculatedRemainingMinutes ?? 0),
        0
      ),
      earliestStart: schedule.projectStart,
      latestFinish: schedule.projectFinish,
      percentComplete: Math.round(
        leaves.reduce((s, t) => s + t.percentComplete, 0) / leaves.length
      ),
      criticalCount: leaves.filter((t) => t.calculatedCritical).length,
      nearCriticalCount: leaves.filter((t) => t.nearCritical).length,
      averageFloatMinutes: null,
      highRiskCount: leaves.filter(
        (t) => t.riskLevel === 'high' || t.riskLevel === 'very-high'
      ).length,
      durationSharePercent: 100,
    })
  }

  return phases.sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes)
}

export function topActivitiesBy(
  tasks: ScheduleTask[],
  field: 'durationMinutes' | 'calculatedRemainingMinutes' | 'riskScore' | 'downstreamReach' | 'totalFloatMinutes',
  n: number,
  ascending = false
): ScheduleTask[] {
  const leaves = leafTasks(tasks)
  const sorted = [...leaves].sort((a, b) => {
    const av = (a[field] as number | null) ?? 0
    const bv = (b[field] as number | null) ?? 0
    return ascending ? av - bv : bv - av
  })
  return sorted.slice(0, n)
}

/** Task duration in working days (falls back to CPM early dates when XML duration is 0). */
export function effectiveTaskDurationDays(task: ScheduleTask, minutesPerDay: number): number {
  if (task.durationMinutes > 0) return task.durationDays
  if (
    task.earlyStartMinutes != null &&
    task.earlyFinishMinutes != null &&
    task.earlyFinishMinutes > task.earlyStartMinutes
  ) {
    return durationDaysFromMinutes(
      task.earlyFinishMinutes - task.earlyStartMinutes,
      minutesPerDay
    )
  }
  return task.durationDays
}

/** Share of CPM project network duration (0–100%). */
export function taskDurationSharePercent(
  task: ScheduleTask,
  projectDurationDays: number,
  minutesPerDay: number
): number {
  if (projectDurationDays <= 0) return 0
  const days = effectiveTaskDurationDays(task, minutesPerDay)
  if (days <= 0) return 0
  return Math.round((days / projectDurationDays) * 1000) / 10
}
