/** Shared CRE Phase 1 export contract (Liparta → Layer 2). */

export type CreGate = 'CONTROL_READY' | 'NOT_CONTROL_READY'
export type FieldValueState = 'VALID' | 'MISSING' | 'UNUSABLE' | 'INVALID' | string
export type ReadinessRowStatus = 'READY' | 'PARTIAL' | 'NOT_READY'
export type UnitSystem = 'metric' | 'imperial'
export type CreUiLanguage = 'en' | 'fa'

export interface FieldState {
  value: unknown
  state: FieldValueState
  note?: string
}

export interface CreProjectContext {
  evaluation_date: string
  unit_system: UnitSystem
  language_ui: CreUiLanguage
}

export interface CreTableStats {
  total_rows: number
  ready_rows: number
  partial_rows?: number
  not_ready_rows: number
}

export interface CreFinding {
  code: string
  severity?: string
  title?: string
  evidence?: unknown
  remediation?: string | string[]
}

export interface CreControlReadyRow {
  task_uid: number
  task_id?: number
  wbs?: string
  name: string
  is_summary: boolean
  location: FieldState
  quantity: FieldState
  quantity_uom: FieldState
  crew_or_resource: FieldState
  person_day: FieldState
  progress_method: FieldState
  start: FieldState
  finish: FieldState
  percent_complete?: FieldState
  readiness_row_status: ReadinessRowStatus
  blockers?: string[]
}

export interface CreControlReadyTable extends CreTableStats {
  rows: CreControlReadyRow[]
}

export interface CreSummary {
  gate: CreGate
  overall_score: number
  blocker_count: number
  finding_codes: string[]
  truth_flags: Record<string, boolean>
  stats: Record<string, number>
  top_remediations: string[]
  table: CreTableStats
  forecast: 'CLOSED' | string
}

export interface CrePhase1Export {
  ok: boolean
  policy_version: string
  project_context: CreProjectContext
  summary: CreSummary
  findings: CreFinding[]
  control_ready_table: CreControlReadyTable
}
