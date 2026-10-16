/**
 * @file features/schedule-intelligence/lib/executive-summary.ts
 * @purpose منطق دامنه — تحلیل کیفیت برنامه و آپلود MSP (executive-summary)
 * @safe-to-edit CAREFUL
 * @affects تحلیل کیفیت برنامه و آپلود MSP
 * @depends-on shared/types/schedule-intelligence, features/schedule-intelligence/lib/schedule-metrics
 */

import type { CpmResult, NormalizedSchedule, PhaseSummary, ProjectKpis } from '@/shared/types/schedule-intelligence'
import { topActivitiesBy } from '@/features/schedule-intelligence/lib/schedule-metrics'
import { SCHEDULE_LIB_COPY as L } from '@/features/schedule-intelligence/lib/config'

export function generateExecutiveSummaryFa(
  schedule: NormalizedSchedule,
  cpm: CpmResult,
  kpis: ProjectKpis,
  phases: PhaseSummary[]
): string {
  const activityCount = kpis.totalLeafTasks
  const depCount = kpis.totalDependencies
  const duration = kpis.calculatedProjectDurationDays.toLocaleString('fa-IR-u-nu-latn')
  const start = schedule.projectStart
    ? new Date(schedule.projectStart).toLocaleDateString('fa-IR-u-nu-latn')
    : L.unknown
  const finish = schedule.projectFinish
    ? new Date(schedule.projectFinish).toLocaleDateString('fa-IR-u-nu-latn')
    : L.unknown
  const criticalCount = kpis.criticalCount

  const highestRiskPhase =
    phases.sort((a, b) => b.highRiskCount - a.highRiskCount)[0]?.name ?? L.unknown

  const topRisks = topActivitiesBy(schedule.tasks, 'riskScore', 3)
    .map((t) => t.name)
    .join(L.listSep)

  const qualityParts: string[] = []
  if (kpis.validationErrorCount > 0) {
    qualityParts.push(L.validationErrors(kpis.validationErrorCount.toLocaleString('fa-IR-u-nu-latn')))
  }
  if (kpis.validationWarningCount > 0) {
    qualityParts.push(L.validationWarnings(kpis.validationWarningCount.toLocaleString('fa-IR-u-nu-latn')))
  }
  const qualityWarningText =
    qualityParts.length > 0
      ? L.qualityAttention(qualityParts.join(L.andSep))
      : L.qualityOk

  const calendarNote =
    schedule.calendars.length === 0
      ? L.calendarNote
      : ''

  if (!cpm.success) {
    return (
      L.cpmFailed(
        activityCount.toLocaleString('fa-IR-u-nu-latn'),
        depCount.toLocaleString('fa-IR-u-nu-latn')
      ) + qualityWarningText
    )
  }

  return (
    L.summaryBody({
      activities: activityCount.toLocaleString('fa-IR-u-nu-latn'),
      deps: depCount.toLocaleString('fa-IR-u-nu-latn'),
      duration,
      start,
      finish,
      critical: criticalCount.toLocaleString('fa-IR-u-nu-latn'),
      phase: highestRiskPhase,
    }) +
    (topRisks ? L.topRisks(topRisks) : '') +
    qualityWarningText +
    calendarNote
  )
}
