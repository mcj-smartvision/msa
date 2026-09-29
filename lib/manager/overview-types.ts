import type { RagResult } from '@/lib/evm/ragStatus'

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
  /** PV ÷ BAC — same basis as the S-curve plan line. */
  plannedPercent: number
  /** EV ÷ BAC — same basis as the S-curve EV line. */
  earnedPercent: number
  /** Weight-based approved physical progress — same basis as the S-curve actual line. */
  actualPercent: number | null
  bac: number
  pv: number
  ev: number
  ac: number
  sv: number
  cv: number
  activityCount: number
  budgetBasis: 'contract_value' | 'weighted_project_budget' | 'none'
  criticalFloatDays: number | null
  floatConsumptionPercent: number | null
  /** Days between today and the date the plan reached today's earned progress (positive = behind). */
  scheduleVarianceDays: number | null
  rag: RagResult
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
  planned: number
  earned: number | null
  actual: number | null
}

export interface ManagerCurve {
  points: ManagerCurvePoint[]
  /** Monthly EV / actual history exists (otherwise only today's point is drawn). */
  hasHistory: boolean
  budgetBasis: ManagerEvmSummary['budgetBasis']
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
  /** Which schedule sets today's target: the baseline, or the updated schedule once the baseline has run out. */
  planBasis: 'baseline' | 'current'
  /** Unfinished activities whose baseline finish has already passed. */
  overdueActivities: number
  /** Leaf activities whose planned window (per `planBasis`) covers today. */
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

export interface ManagerCriticalDelay {
  id: string
  name: string
  wbs: string | null
  /** Forecast (or today, if overdue) minus baseline finish, in days. */
  delayDays: number
  totalFloatDays: number | null
  importance: 'negative_float' | 'critical' | 'zero_float'
  percent: number
  baselineFinish: string
  forecastFinish: string
  overdue: boolean
}

export interface ManagerCriticalDelays {
  items: ManagerCriticalDelay[]
  total: number
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
}
