export type RagStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL'

/* ------------------------------------------------------- KPI contract */

/** gray = no threshold applies or the data is not usable; read `data_quality` to tell which. */
export type KpiStatus = 'green' | 'yellow' | 'red' | 'gray'

export type DataQuality = 'ok' | 'missing' | 'stale' | 'invalid'

export interface KpiEvidence {
  sources: string[]
  /** ISO date (YYYY-MM-DD) of the oldest input the value rests on. */
  asOf: string
}

/** The only shape a KPI may be rendered from (see docs/kpi-engine-contract.md). */
export interface ExplainedKpi<T = number> {
  key: string
  title_fa: string
  /** Always null unless data_quality is 'ok' or 'stale'. */
  value: T | null
  unit: string
  formula: string
  substitution: string
  interpretation_fa: string
  status: KpiStatus
  data_quality: DataQuality
  evidence: KpiEvidence
  /** Why the value is missing or invalid; required when data_quality is 'missing' or 'invalid'. */
  reason_fa?: string
  code?: string
  actionable_decision_fa?: string
  assumptions?: string[]
  debug?: Record<string, unknown>
}

/** One raw input with its provenance; a missing input carries its reason instead of a value. */
export interface SnapshotField<T> {
  value: T | null
  quality: DataQuality
  source: string
  asOf: string
  reason_fa?: string
}

export interface WeeklyPlanCounts {
  planned: number
  completed: number
  weekStart: string
  weekEnd: string
}

/** Raw project-controls data every KPI reads from. Built once per request/render. */
export interface ControlsSnapshot {
  projectId: string
  /** Status date of the snapshot (YYYY-MM-DD, Tehran). */
  asOf: string
  generatedAt: string
  periodUnit: 'days' | 'weeks' | 'months'
  daysPerUnit: number
  budgetBasis: string
  /** What PV/EV/the PV curve are weighted by: MSP schedule weights, or budgets when no weights exist. */
  progressBasis: 'schedule_weight' | 'budget'
  bac: SnapshotField<number>
  /** Planned progress, percent of the project (Σ wᵢ·plannedᵢ ÷ Σ wᵢ). */
  pv: SnapshotField<number>
  /** Earned progress, percent of the project (Σ wᵢ·physicalᵢ ÷ Σ wᵢ) — the ES input. */
  ev: SnapshotField<number>
  /** Cost-basis earned value in money, Σ(budget × physical %) — the TCPI input. */
  evCost: SnapshotField<number>
  ac: SnapshotField<number>
  /** Date of the latest recorded actual cost up to the status date. */
  lastCostDate: SnapshotField<string>
  pvCurve: SnapshotField<PVCurvePoint[]>
  projectStart: SnapshotField<string>
  baselineFinish: SnapshotField<string>
  /** PD in periods. */
  plannedDuration: SnapshotField<number>
  /** AT in periods. */
  actualTime: SnapshotField<number>
  /** ES in periods. */
  earnedSchedule: SnapshotField<number>
  weeklyPlan: SnapshotField<WeeklyPlanCounts>
  /** Weight-consistency problems (data-quality log); weights were scaled and the KPIs still computed. */
  weightIssues: string[]
}

export interface PVCurvePoint {
  periodIndex: number
  cumulativePV: number
  date?: string
}

export interface EarnedScheduleInput {
  projectStartDate: Date | string
  statusDate?: Date | string
  currentEV: number
  baselinePVCurve: PVCurvePoint[]
  plannedDurationPeriods: number
  periodUnit?: 'days' | 'weeks' | 'months'
  customDaysPerUnit?: number
}

export interface ExplainedMetric {
  key: string
  label_fa: string
  value: number | null
  unit: string
  formula: string
  substitution: string
  interpretation_fa: string
  rag?: RagStatus
  assumptions?: string[]
  debug?: Record<string, unknown>
}

export interface ActionableMetric {
  key: string
  /** Catalog code, e.g. 'KPI-04', 'KPI-05'. */
  code: string
  label_fa: string
  value: number | null
  unit: string
  formula: string
  substitution: string
  interpretation_fa: string
  actionable_decision_fa: string
  rag: RagStatus
  debug?: Record<string, unknown>
}

export interface TcpiPpcInput {
  bac: number
  ev: number
  ac: number
  leanWeeklyPlanned: number
  leanWeeklyCompleted: number
}

export interface ControlsEngineResult {
  metrics: {
    es: ExplainedMetric
    at: ExplainedMetric
    spi_t: ExplainedMetric
    sv_t: ExplainedMetric
    eac_t: ExplainedMetric
    delay_forecast: ExplainedMetric
  }
  overallRag: RagStatus
  ragTokens: {
    bg: string
    text: string
    border: string
  }
  summaryTextFa: string
  computedAt: string
}
