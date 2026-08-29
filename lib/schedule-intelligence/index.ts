import type { ScheduleAnalysisConfig, ScheduleDashboardResult } from '@/types/schedule-intelligence'
import { mergeScheduleConfig } from '@/lib/schedule-intelligence/config'
import { runCpmEngine } from '@/lib/schedule-intelligence/cpmEngine'
import { generateExecutiveSummaryFa } from '@/lib/schedule-intelligence/executiveSummary'
import { runRiskAnalysis } from '@/lib/schedule-intelligence/riskAnalyzer'
import {
  applyActivityDerivedFields,
  validateScheduleQuality,
} from '@/lib/schedule-intelligence/scheduleQuality'
import { buildPhaseSummaries, buildProjectKpis } from '@/lib/schedule-intelligence/scheduleMetrics'
import { parseMicrosoftProjectXml } from '@/lib/schedule-intelligence/xmlParser'

export function analyzeScheduleFromXml(
  xmlContent: string,
  sourceFileName?: string,
  configPartial?: Partial<ScheduleAnalysisConfig>
): ScheduleDashboardResult {
  const config = mergeScheduleConfig({
    ...configPartial,
    minutesPerDay: configPartial?.minutesPerDay,
  })

  const { schedule, invalidRecords } = parseMicrosoftProjectXml(xmlContent, sourceFileName)

  if (configPartial?.minutesPerDay) {
    schedule.minutesPerDay = configPartial.minutesPerDay
  }

  const qualityWarnings = validateScheduleQuality(schedule, config)
  schedule.warnings = [...schedule.warnings, ...invalidRecords, ...qualityWarnings]

  applyActivityDerivedFields(schedule, config)

  const fatalErrors = schedule.warnings.filter((w) => w.severity === 'error')
  const hasCycle = fatalErrors.some((w) => w.code === 'CYCLE_DETECTED')

  let cpm = runCpmEngine(schedule, config)

  if (!cpm.success || hasCycle) {
    const executiveSummary = generateExecutiveSummaryFa(
      schedule,
      cpm,
      buildProjectKpis(schedule, cpm, config, schedule.warnings),
      []
    )
    return {
      schedule,
      cpm,
      kpis: buildProjectKpis(schedule, cpm, config, schedule.warnings),
      phases: [],
      executiveSummary,
      analysisDate: config.analysisDate,
      hasFatalErrors: true,
    }
  }

  runRiskAnalysis(schedule.tasks, schedule.warnings, config)

  const phases = buildPhaseSummaries(schedule, config)
  const kpis = buildProjectKpis(schedule, cpm, config, schedule.warnings)
  const executiveSummary = generateExecutiveSummaryFa(schedule, cpm, kpis, phases)

  return {
    schedule,
    cpm,
    kpis,
    phases,
    executiveSummary,
    analysisDate: config.analysisDate,
    hasFatalErrors: fatalErrors.length > 0,
  }
}
