import type { EvmBudgetBasis } from '@/lib/evm/metrics'
import type { RagResult } from '@/lib/evm/ragStatus'
import type { EvForecast } from '@/lib/project-controls/ev-forecast'

/** Each dashboard section loads independently; a missing table never zeroes another section. */
export type SectionResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string }

export type ManagerPeriod = 'today' | 'week' | 'month'

export interface ManagerProjectInfo {
  id: string
  name: string
  code: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
}

export interface ManagerEvmSummary {
  asOf: string
  spi: number | null
  cpi: number | null
  /** Σ wᵢ·plannedᵢ ÷ Σ wᵢ (schedule weights) — same basis as the S-curve plan line. */
  plannedPercent: number
  /** Σ wᵢ·physicalᵢ ÷ Σ wᵢ (schedule weights) — same basis as the S-curve EV line; SPI = earned ÷ planned. */
  earnedPercent: number
  /** Weight-based approved physical progress — same basis as the S-curve actual line. */
  actualPercent: number | null
  bac: number
  pv: number
  ev: number
  /** Σ(budget × physical %) — cost-basis EV behind CV and CPI. */
  evAmount: number
  ac: number
  sv: number
  cv: number
  activityCount: number
  budgetBasis: EvmBudgetBasis
  progressBasis: 'schedule_weight' | 'budget'
  criticalFloatDays: number | null
  floatConsumptionPercent: number | null
  /** Earned Schedule variance in calendar days, AT − ES (positive = behind). */
  scheduleVarianceDays: number | null
  scheduleForecast: ManagerScheduleForecast | null
  rag: RagResult
}

export interface ManagerScheduleForecast {
  /** Earliest baseline start of the schedule. */
  start: string
  /** Latest baseline finish of the schedule. */
  plannedFinish: string
  /** Optimistic: planned finish + (AT − ES) — remaining work at plan speed (never before today while work remains). */
  forecastFinish: string
  /** Trend: today + (PD − ES) ÷ SPI(t); null when nothing is earned yet. */
  trendFinish: string | null
  /** AT − ES in calendar days (positive = behind). */
  varianceDays: number
  actualTimeDays: number
  earnedScheduleDays: number
  plannedDurationDays: number
  /** ES ÷ AT; null before the baseline start. */
  spiT: number | null
  /** Today is past the baseline finish — re-baseline should be considered. */
  planPeriodEnded: boolean
}

export interface ManagerDecisionItem {
  id: string
  kind: 'package_approval' | 'change_request'
  title: string
  subtitle: string | null
  updatedAt: string | null
}

export interface ManagerDecisions {
  items: ManagerDecisionItem[]
  total: number
}

export type ManagerAlertLevel = 'critical' | 'warning'
export type ManagerAlertDomain = 'schedule' | 'cost' | 'safety' | 'materials' | 'quality'

export interface ManagerAlertItem {
  label: string
  occurredAt: string | null
}

export interface ManagerAlert {
  id: string
  level: ManagerAlertLevel
  domain: ManagerAlertDomain
  title: string
  cause: string
  impact: string
  suggestion: string
  occurredAt: string | null
  /** Event alerts are narrowed by the header period; state alerts (SPI, stock) always show. */
  eventBased: boolean
  /** Records merged into this card, most urgent first. */
  items: ManagerAlertItem[]
}

export interface ManagerQuality {
  openNcrCount: number
  criticalNcrCount: number
  source: 'qc_engine' | 'legacy'
}

/** Confirmed HSE alerts sent by site supervisors (`ai_actions` of type `hse_alert`). */
export interface ManagerHse {
  windowDays: number
  critical: number
  warning: number
  info: number
  totalEver: number
  lastAlertAt: string | null
  lastSeriousAt: string | null
  /** Days since the last warning/critical alert; null when none was ever reported. */
  daysSinceSerious: number | null
}

export interface ManagerSiteToday {
  date: string
  attendance: SectionResult<{
    insideCount: number
    outsideCount: number
    absentCount: number
    failedCountToday: number
  }>
  inventory: SectionResult<{
    trackedCount: number
    lowStock: { id: string; name: string; current: number; min: number; unit: string | null }[]
  }>
  quality: SectionResult<ManagerQuality>
  hse: SectionResult<ManagerHse>
}

export type ManagerPulseKey = 'daily_report' | 'warehouse' | 'hse' | 'gate'

export interface ManagerPulsePerson {
  userId: string
  name: string
  lastSignInAt: string | null
}

export interface ManagerPulseSource {
  key: ManagerPulseKey
  label: string
  roleLabel: string
  status: 'fresh' | 'stale' | 'never' | 'unavailable'
  lastActivityAt: string | null
  thresholdHours: number
  detail: string | null
  reason: string | null
  responsible: ManagerPulsePerson[]
  lastReminderAt: string | null
  canRemind: boolean
}

export interface ManagerResources {
  presentToday: number
  insideNow: number
  workers: number
  technical: number
  other: number
}

export interface ManagerInvoiceSummary {
  count: number
  totalInvoiced: number
  totalPaid: number
  pendingCount: number
  pendingAmount: number
  approvedUnpaidCount: number
  approvedUnpaidAmount: number
  lastInvoiceDate: string | null
}

export interface ManagerCurvePoint {
  date: string
  /** True for the point that represents today (matches the KPI cards). */
  isToday: boolean
  /** `month` = Jalali month end, `record` = a day with recorded progress, `today` = now, `forecast` = forecast finish. */
  kind: 'month' | 'record' | 'today' | 'forecast'
  planned: number
  earned: number | null
  actual: number | null
  /** Forecast EV (today onward, see `ManagerCurve.forecast`); null where no forecast applies. */
  forecast: number | null
}

export interface ManagerCurve {
  points: ManagerCurvePoint[]
  /** Monthly EV / actual history exists (otherwise only today's point is drawn). */
  hasHistory: boolean
  /** First day of recorded progress; the actual / EV lines start here. */
  historyStart: string | null
  budgetBasis: ManagerEvmSummary['budgetBasis']
  /** EV forecast from the explainable engine (SPI(t), EAC(t), DelayDays), or why it is not drawn. */
  forecast: EvForecast
}

export interface ManagerDailyDelta {
  /** Start of the rolling 24-hour window (ISO timestamp). */
  windowStart: string
  /** Project-level progress the plan allots to these 24 hours, on the schedule's physical weights. */
  plannedPercent: number
  /** Project-level progress recorded in the window, on the same physical weights. */
  actualPercent: number
  deltaPercent: number
  /** actual ÷ planned × 100; null when nothing was planned for today. */
  fulfillmentPercent: number | null
  /** Today's target always comes from the frozen baseline; true once every baseline window has ended. */
  baselineEnded: boolean
  /** Unfinished activities whose baseline finish has already passed. */
  overdueActivities: number
  /** Leaf activities whose baseline window covers today. */
  plannedActivities: number
  /** Of the planned activities, how many recorded progress in the window. */
  plannedReportedActivities: number
  /** All activities that recorded progress in the window (planned or not). */
  reportedActivities: number
  lastProgressAt: string | null
  lastDailyReport: { date: string; approved: boolean } | null
}

export type ManagerBlockerCategory = 'site' | 'materials' | 'quality' | 'schedule'

export interface ManagerBlocker {
  id: string
  category: ManagerBlockerCategory
  level: 'critical' | 'warning'
  title: string
  impact: string
  owner: string | null
  since: string | null
}

export interface ManagerBlockers {
  items: ManagerBlocker[]
  /** Sources that were read, so an empty list is explicit about what was checked. */
  checkedSources: string[]
}

/** A recorded reason a front is stuck, linked to the activity. */
export interface CriticalFrontCause {
  kind: 'material' | 'site' | 'schedule' | 'quality'
  /** Where it was recorded: a schedule alert or a stopped work order of today's site plan. */
  source: 'alert' | 'work_order'
  ref: string
  label_fa: string
  severity: 'critical' | 'warning'
  since: string | null
}

export type CriticalFrontActionKind = 'add_crew' | 'resequence' | 'material_supply' | 'contractor_review'

/** Operational suggestion; `payload` is a ready directive draft for the future work-order system. */
export interface CriticalFrontAction {
  kind: CriticalFrontActionKind
  label_fa: string
  rationale_fa: string
  /** Backed by this activity's data (gap, linked cause, successors, contractor); shown first. */
  recommended: boolean
  owner_role: 'PM' | 'Planner' | 'SiteManager' | 'Procurement'
  payload: {
    schema: 'directive.draft/v1'
    source: 'manager.critical_fronts'
    projectId: string
    action: CriticalFrontActionKind
    task: { id: string; name: string; wbs: string | null }
    owner_role: CriticalFrontAction['owner_role']
    due_date: string
    evidence: {
      asOf: string
      delayDays: number
      totalFloatDays: number | null
      plannedPercent: number
      actualPercent: number
      baselineFinish: string | null
      forecastFinish: string
      causes: { kind: CriticalFrontCause['kind']; source: CriticalFrontCause['source']; ref: string }[]
    }
    params: Record<string, unknown>
  }
}

export type CriticalFrontCpm =
  | {
      status: 'ok'
      calculatedAt: string | null
      dependencyCount: number
      activityCount: number
      /** Activities with no predecessor and no successor; their float is not meaningful. */
      unlinkedCount: number
    }
  | { status: 'data_missing'; reason_fa: string; missing: { key: string; label_fa: string; detail_fa: string }[] }

export interface ManagerCriticalDelay {
  id: string
  name: string
  wbs: string | null
  /** Forecast (or today, if overdue) minus baseline finish, in days. */
  delayDays: number
  /** CPM total float; null without a CPM network. */
  totalFloatDays: number | null
  importance: 'negative_float' | 'critical' | 'zero_float' | 'baseline_delay'
  /** Actual (approved physical) percent. */
  percent: number
  percentFromPackages: boolean
  /** Linear share of the frozen baseline window elapsed today (calendar days). */
  plannedPercent: number
  baselineFinish: string
  forecastFinish: string
  overdue: boolean
  contractor: string | null
  predecessorCount: number
  successorCount: number
  causes: CriticalFrontCause[]
  actions: CriticalFrontAction[]
}

export interface ManagerCriticalDelays {
  items: ManagerCriticalDelay[]
  total: number
  /** `cpm`: critical / zero-float activities; `baseline`: any activity late against the baseline. */
  mode: 'cpm' | 'baseline'
  cpm: CriticalFrontCpm
  causeSources: string[]
}

/* --------------------------------------------------- Period comparison */

export type ComparisonMetricKey = 'physical' | 'spi' | 'headcount' | 'completed' | 'overdue' | 'issues'

/** `not_reported` is data not yet entered for the window — never shown or scored as zero. */
export type ComparisonValue =
  | { state: 'ok'; value: number }
  | { state: 'not_reported'; reason: string }
  | { state: 'unavailable'; reason: string }

export type ComparisonVerdict = 'better' | 'worse' | 'same' | 'neutral'

export interface ComparisonBreakdownRow {
  key: string
  label: string
  current: number
  previous: number
}

export interface ComparisonMetric {
  key: ComparisonMetricKey
  label: string
  /** How the number is measured, e.g. «پیشرفت وزنی تأییدشده». */
  basis: string
  unit: 'points' | 'index' | 'people' | 'count'
  higherIsBetter: boolean
  current: ComparisonValue
  previous: ComparisonValue
  /** (current − previous) ÷ |previous| × 100; null when either side is missing or previous is 0. */
  changePercent: number | null
  verdict: ComparisonVerdict
  breakdown?: ComparisonBreakdownRow[]
  /** Value that fills a comparison bar (e.g. total activities); absent when the metric has no natural total. */
  scaleMax?: number
  /** Cumulative level at each cutoff (physical progress only) — equals the «پیشرفت تجمعی» card at now. */
  levels?: { current: number | null; previous: number | null; planned: number | null }
}

export interface ComparisonWindow {
  start: string
  /** Same elapsed time into the period — the comparison stops here. */
  cutoff: string
  end: string
  label: string
}

export interface ComparisonPointActivity {
  name: string
  /** Weighted progress added in this bucket, percentage points of the activity. */
  deltaPercent: number
}

export interface ComparisonPointDetail {
  at: string
  /** Cumulative weighted physical progress of the project at `at`. */
  level: number | null
  headcount: number | null
  completed: number
  issues: number
  activities: ComparisonPointActivity[]
}

export interface ComparisonChartPoint {
  index: number
  label: string
  /** Cumulative weighted physical progress; null for the part of the current period still ahead. */
  current: number | null
  previous: number | null
  planned: number | null
  currentDetail: ComparisonPointDetail | null
  previousDetail: ComparisonPointDetail | null
}

export interface ComparisonCause {
  id: string
  source: 'daily_report' | 'workshop' | 'site_plan'
  category: string
  text: string
  activity: string | null
  at: string
}

export interface PeriodComparison {
  projectId: string
  period: ManagerPeriod
  generatedAt: string
  current: ComparisonWindow
  previous: ComparisonWindow
  metrics: ComparisonMetric[]
  summary: { better: number; worse: number; same: number; neutral: number }
  chart: SectionResult<{
    points: ComparisonChartPoint[]
    cutoffIndex: number
    /** False when the window has no report or starts before recorded history — the line is not drawn. */
    currentReported: boolean
    /** Whether the previous window has any progress report. */
    previousReported: boolean
    /** Previous line is drawn from recorded history (flat before the first record, never an invented gain). */
    previousDrawn: boolean
    /** First recorded progress report of the project. */
    historyStart: string | null
  }>
  causes: SectionResult<{ current: ComparisonCause[]; previous: ComparisonCause[] }>
  warnings: string[]
}

export interface ManagerOverview {
  project: ManagerProjectInfo | null
  generatedAt: string
  evm: SectionResult<ManagerEvmSummary>
  decisions: SectionResult<ManagerDecisions>
  alerts: SectionResult<ManagerAlert[]>
  site: ManagerSiteToday
  pulse: SectionResult<ManagerPulseSource[]>
  resources: SectionResult<ManagerResources>
  invoices: SectionResult<ManagerInvoiceSummary>
  progress: SectionResult<ManagerCurve>
  daily: SectionResult<ManagerDailyDelta>
  blockers: SectionResult<ManagerBlockers>
  delays: SectionResult<ManagerCriticalDelays>
  upcoming: SectionResult<ManagerUpcomingDeadline[]>
}

/** Nearest forecast finish of an unfinished schedule activity. */
export interface ManagerUpcomingDeadline {
  id: string
  name: string
  wbs: string | null
  due: string
  percent: number
}
