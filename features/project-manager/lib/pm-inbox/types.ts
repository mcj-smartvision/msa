import type { ControlsSnapshot, DataQuality, ExplainedKpi } from '@/shared/types/project-controls'

export type InboxCategory = 'Financials' | 'LeanOps' | 'Controls' | 'Claims' | 'HSE'
export type InboxSeverity = 'critical' | 'warning' | 'info'
export type InboxOwnerRole = 'PM' | 'Planner' | 'QS' | 'SiteManager' | 'HSE'

/** Dashboard destinations an action may open; the UI resolves them to permitted routes. */
export type InboxRoute = 'gantt' | 'scheduleIntel' | 'finance' | 'evm' | 'background' | 'wwp' | 'procurement'

export type InboxAction =
  | { label_fa: string; action_type: 'navigate'; payload: { route: InboxRoute; query?: Record<string, string> } }
  | { label_fa: string; action_type: 'api_call'; payload: { method: 'POST' | 'PATCH'; url: string; body: Record<string, unknown> } }
  /** Prepared but not yet persisted (no backing entity): the UI confirms and keeps the payload. */
  | { label_fa: string; action_type: 'draft'; payload: { kind: string } & Record<string, unknown> }

export interface InboxEvidenceMetric {
  key: string
  label_fa: string
  value: number | string | null
  unit?: string
  data_quality: DataQuality
}

export interface InboxEvidence {
  metrics: InboxEvidenceMetric[]
  sources: string[]
  asOf: string
}

export interface InboxItem {
  /** Stable per rule, project and status date. */
  id: string
  category: InboxCategory
  title_fa: string
  description_fa: string
  severity: InboxSeverity
  suggested_actions: InboxAction[]
  owner_role: InboxOwnerRole
  /** Suggested due date (YYYY-MM-DD, Tehran). */
  due_date: string
  /** Why the item exists: the rule that fired, with the observed value against its threshold. */
  trigger: { rule: string; rule_fa: string; observed_fa: string }
  evidence: InboxEvidence
}

/** Daily site report freshness, as computed for the site pulse (`ManagerPulseSource` of key `daily_report`). */
export interface DailyReportPulse {
  status: 'fresh' | 'stale' | 'never' | 'unavailable'
  lastActivityAt: string | null
  thresholdHours: number
  responsible: string[]
  reason: string | null
}

export interface PmInboxSnapshot {
  projectId: string
  /** Tehran today (YYYY-MM-DD); due dates are counted from it. */
  today: string
  controls: ControlsSnapshot
  kpis: Record<string, ExplainedKpi>
  dailyReport?: DailyReportPulse | null
}
