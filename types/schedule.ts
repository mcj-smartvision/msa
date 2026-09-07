/** MSP schedule + daily report domain types (tables from migration 24). */

export type TaskRelationType = 'FS' | 'SS' | 'FF' | 'SF'

export type AlertType =
  | 'start_activity'
  | 'delay_risk'
  | 'material_purchase'
  | 'milestone_risk'
  | 'critical_path'
  | 'general'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface ProjectTask {
  id: string
  project_id: string
  msp_uid: number | null
  wbs_code: string | null
  name: string
  start_planned: string | null
  finish_planned: string | null
  start_current: string | null
  finish_current: string | null
  baseline_start: string | null
  baseline_finish: string | null
  percent_complete: number
  is_critical: boolean
  /** MSP activity weight (وزن) from custom field */
  schedule_weight?: number | null
  /** MSP summary row (WBS group / زیرشاخه) */
  is_summary?: boolean
  /** Duration in days (migration 71) */
  duration_days?: number | null
  /** WBS parent task for expand/collapse tree (migration 71) */
  parent_id?: string | null
  /** MSP milestone (migration 71) */
  is_milestone?: boolean
  /** First CPM predicted date for milestone — immutable once set (migration 74) */
  milestone_baseline_date?: string | null
  /** Registered project subcontractor (migration 42) */
  subcontractor_id?: string | null
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  id: string
  project_id: string
  predecessor_task_id: string
  successor_task_id: string
  relation_type: TaskRelationType
  lag_duration: number
  created_at: string
}

export interface SiteDailyReport {
  id: string
  project_id: string
  report_date: string
  site_supervisor_id: string
  raw_text: string
  summary_text?: string | null
  ai_status?: 'draft_by_ai' | 'confirmed_by_user' | 'rejected_by_user'
  ai_parsed: DailyReportAiParsed | null
  approved_by_manager: boolean
  approved_at: string | null
  approved_by: string | null
  created_at: string
}

export interface TaskProgressUpdate {
  id: string
  project_id: string
  task_id: string
  report_id: string | null
  progress_date: string
  percent_complete: number
  note: string | null
  created_by: string | null
  created_at: string
}

export interface ProjectAlert {
  id: string
  project_id: string
  related_task_id: string | null
  alert_type: AlertType
  message: string
  severity: AlertSeverity
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
}

export interface ScheduleImport {
  id: string
  project_id: string
  file_name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  tasks_imported: number
  dependencies_imported: number
  error_message: string | null
  imported_by: string | null
  created_at: string
  completed_at: string | null
  storage_path?: string | null
  storage_bucket?: string | null
}

/** Structured output from AI daily report parsing (design contract). */
export interface DailyReportAiParsed {
  tasks: Array<{
    name: string
    progress: number
    delay?: number
    task_id?: string
  }>
  issues: string[]
  risks: string[]
  materials: Array<{
    name: string
    status: string
  }>
  summary?: string
}

export interface CreateDailyReportInput {
  project_id: string
  report_date: string
  raw_text: string
}

export interface MspImportResult {
  import_id: string
  tasks_imported: number
  dependencies_imported: number
  baseline_start?: string
  needs_start_confirmation?: boolean
}

export interface ProjectScheduleSummary {
  totalTasks: number
  completedTasks: number
  delayedTasks: number
  criticalTasks: number
  overallPercentComplete: number
  unresolvedAlerts: number
}
