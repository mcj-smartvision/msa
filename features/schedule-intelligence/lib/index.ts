import type { ScheduleAnalysisConfig, ScheduleDashboardResult } from '@/shared/types/schedule-intelligence'
import { mergeScheduleConfig } from '@/features/schedule-intelligence/lib/config'
import { runCpmEngine } from '@/features/schedule-intelligence/lib/cpm-engine'
import { generateExecutiveSummaryFa } from '@/features/schedule-intelligence/lib/executive-summary'
import { runRiskAnalysis } from '@/features/schedule-intelligence/lib/risk-analyzer'
import {
applyActivityDerivedFields,
validateScheduleQuality,
} from '@/features/schedule-intelligence/lib/schedule-quality'
import { buildPhaseSummaries, buildProjectKpis } from '@/features/schedule-intelligence/lib/schedule-metrics'
import { parseMicrosoftProjectXml } from '@/features/schedule-intelligence/lib/xml-parser'

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
