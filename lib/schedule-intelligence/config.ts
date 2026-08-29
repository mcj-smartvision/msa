import type { ScheduleAnalysisConfig } from '@/types/schedule-intelligence'

/** Central configuration — do not scatter thresholds across modules. */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleAnalysisConfig = {
  analysisDate: new Date().toISOString().slice(0, 10),
  minutesPerDay: 480,
  minutesPerWeek: 2400,
  daysPerMonth: 20,
  weekendDays: [6, 0],
  criticalFloatEpsilonMinutes: 0,
  nearCriticalFloatDays: 10,
  riskWeights: {
    criticality: 30,
    float: 25,
    status: 20,
    duration: 10,
    dependency: 10,
    dataQuality: 5,
  },
  riskThresholds: { low: 25, medium: 50, high: 75 },
  topN: 10,
  includeSummaryInReports: false,
  honorProjectDeadline: false,
  timezonePolicy: 'utc-date',
}

export function mergeScheduleConfig(
  partial?: Partial<ScheduleAnalysisConfig>
): ScheduleAnalysisConfig {
  return { ...DEFAULT_SCHEDULE_CONFIG, ...partial }
}
