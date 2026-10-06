/** Schedule Intelligence — canonical deterministic schedule model (MSP XML → CPM → KPIs). */

export type RelationType = 'FS' | 'SS' | 'FF' | 'SF'

export type ScheduleWarningSeverity = 'info' | 'warning' | 'error'

export type ActivityStatus = 'not-started' | 'in-progress' | 'completed' | 'unknown'

export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high'

export type StartTimingLabel =
  | 'overdue'
  | 'starts-today'
  | 'starts-within-7'
  | 'starts-within-30'
  | 'starts-later'
  | 'already-started'
  | 'completed'

export interface ScheduleDependency {
  predecessorUid: string
  successorUid: string
  type: RelationType
  lagMinutes: number
  rawType: number | null
}

export interface ScheduleTask {
  uid: string
  id: number | null
  name: string
  wbs: string | null
  outlineNumber: string | null
  outlineLevel: number | null
  parentUid: string | null
  isSummary: boolean

  start: string | null
  finish: string | null
  durationMinutes: number
  durationDays: number

  percentComplete: number
  isCriticalFromSource: boolean | null
  calendarUid: string | null

  actualStart: string | null
  actualFinish: string | null
  actualDurationMinutes: number | null
  remainingDurationMinutes: number | null
  constraintType: number | null
  constraintDate: string | null
  notes: string | null

  predecessors: ScheduleDependency[]
  successors: ScheduleDependency[]

  earlyStartMinutes: number | null
  earlyFinishMinutes: number | null
  lateStartMinutes: number | null
  lateFinishMinutes: number | null
  totalFloatMinutes: number | null
  freeFloatMinutes: number | null
  calculatedCritical: boolean
  nearCritical: boolean

  status: ActivityStatus
  calculatedRemainingMinutes: number | null
  daysUntilStartCalendar: number | null
  daysUntilStartWorking: number | null
  startTimingLabel: StartTimingLabel | null

  riskScore: number | null
  riskLevel: RiskLevel | null
  riskReasons: string[]

  bottleneckScore: number | null

  indegree: number
  outdegree: number
  downstreamReach: number

  sourceData: Record<string, unknown>
}

export interface ScheduleWarning {
  code: string
  severity: ScheduleWarningSeverity
  message: string
  taskUid?: string
  taskName?: string
  details?: string
}

export interface NormalizedSchedule {
  projectName: string | null
  projectStart: string | null
  projectFinish: string | null
  sourceFileName: string | null
  minutesPerDay: number
  minutesPerWeek: number
  daysPerMonth: number
  tasks: ScheduleTask[]
  dependencies: ScheduleDependency[]
  calendars: unknown[]
  warnings: ScheduleWarning[]
  metadata: Record<string, unknown>
}

export interface CpmResult {
  success: boolean
  projectDurationMinutes: number
  projectDurationDays: number
  projectEarlyFinishMinutes: number
  criticalUids: string[]
  criticalChains: string[][]
  nearCriticalUids: string[]
  errors: ScheduleWarning[]
  sourceMismatchCount: number
}

export interface ProjectKpis {
  projectName: string | null
  sourceFileName: string | null
  analysisDate: string
  totalActivities: number
  totalSummaryTasks: number
  totalMilestones: number
  totalLeafTasks: number
  totalDependencies: number
  projectStart: string | null
  projectFinish: string | null
  calculatedProjectDurationDays: number
  calendarBasisMinutesPerDay: number
  dataQualityStatus: 'ok' | 'warnings' | 'errors'
  notStartedCount: number
  inProgressCount: number
  completedCount: number
  unknownStatusCount: number
  averagePercentComplete: number
  criticalCount: number
  criticalityRatio: number
  nearCriticalCount: number
  shortestFloatMinutes: number | null
  averageTotalFloatMinutes: number | null
  negativeFloatCount: number
  fsCount: number
  ssCount: number
  ffCount: number
  sfCount: number
  openStartCount: number
  openFinishCount: number
  validationErrorCount: number
  validationWarningCount: number
  cycleCount: number
  sourceCpmMismatchCount: number
}

export interface PhaseSummary {
  wbs: string
  name: string
  activityCount: number
  totalDurationMinutes: number
  remainingDurationMinutes: number
  earliestStart: string | null
  latestFinish: string | null
  percentComplete: number
  criticalCount: number
  nearCriticalCount: number
  averageFloatMinutes: number | null
  highRiskCount: number
  durationSharePercent: number
}

export interface ScheduleAnalysisConfig {
  analysisDate: string
  minutesPerDay: number
  minutesPerWeek: number
  daysPerMonth: number
  weekendDays: number[]
  criticalFloatEpsilonMinutes: number
  nearCriticalFloatDays: number
  riskWeights: {
    criticality: number
    float: number
    status: number
    duration: number
    dependency: number
    dataQuality: number
  }
  riskThresholds: { low: number; medium: number; high: number }
  topN: number
  includeSummaryInReports: boolean
  honorProjectDeadline: boolean
  timezonePolicy: 'utc-date' | 'local-date'
}

export interface ScheduleDashboardResult {
  schedule: NormalizedSchedule
  cpm: CpmResult
  kpis: ProjectKpis
  phases: PhaseSummary[]
  executiveSummary: string
  analysisDate: string
  hasFatalErrors: boolean
}
