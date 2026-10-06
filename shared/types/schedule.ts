/** MSP schedule + daily report domain types (tables from migration 24+). */

export type TaskRelationType = 'FS' | 'SS' | 'FF' | 'SF'

export type ScheduleConstraintType =
  | 'ASAP'
  | 'ALAP'
  | 'SNET'
  | 'SNLT'
  | 'FNET'
  | 'FNLT'
  | 'MSO'
  | 'MFO'

export type ScheduleResourceType = 'work' | 'material' | 'cost'

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
  /** Text source id (MSP UID as text) — migration 75 */
  external_id?: string | null
  wbs_code: string | null
  outline_number?: string | null
  outline_level?: number | null
  name: string
  start_planned: string | null
  finish_planned: string | null
  start_current: string | null
  finish_current: string | null
  baseline_start: string | null
  baseline_finish: string | null
  baseline_duration_days?: number | null
  baseline_cost?: number | null
  baseline_work_hours?: number | null
  percent_complete: number
  /** Physical % — primary truth (migration 75); falls back to percent_complete */
  physical_percent_complete?: number | null
  is_critical: boolean
  /** MSP activity weight (وزن) from custom field */
  schedule_weight?: number | null
  /** Physical weight for weighted progress (migration 75); often mirrors schedule_weight */
  physical_weight?: number | null
  /** Generated: physical_weight × physical_percent_complete / 100 */
  earned_weighted_progress?: number | null
  /** MSP summary row (WBS group / زیرشاخه) */
  is_summary?: boolean
  /** Duration in days (migration 71) */
  duration_days?: number | null
  remaining_duration_days?: number | null
  /** WBS parent task for expand/collapse tree (migration 71) */
  parent_id?: string | null
  /** MSP milestone (migration 71) */
  is_milestone?: boolean
  /** First CPM predicted date for milestone — immutable once set (migration 74) */
  milestone_baseline_date?: string | null
  obs_code?: string | null
  cbs_code?: string | null
  calendar_id?: string | null
  constraint_type?: ScheduleConstraintType | string | null
  constraint_date?: string | null
  deadline?: string | null
  total_float_days?: number | null
  free_float_days?: number | null
  actual_start?: string | null
  actual_finish?: string | null
  actual_duration_days?: number | null
  /** Data Date همان بار Import/محاسبه */
  status_date?: string | null
  /**
   * Progress pace: physical% ÷ expected% (migration 77).
   * Only set for in-progress activities.
   */
  pace_ratio?: number | null
  /** good | warning | bad | null */
  pace_status?: 'good' | 'warning' | 'bad' | null
  /** Smart progress 2×2 quadrant (migration 78) */
  alert_quadrant?: 'urgent' | 'normal_watch' | 'soft_notice' | 'no_display' | null
  work_hours?: number | null
  cost?: number | null
  fixed_cost?: number | null
  planned_value?: number | null
  earned_value?: number | null
  actual_cost?: number | null
  notes?: string | null
  flag?: boolean
  priority?: number | null
  is_manual_scheduled?: boolean
  has_split?: boolean
  is_recurring_master?: boolean
  source_file?: string | null
  imported_at?: string | null
  /** Registered project subcontractor (migration 42) */
  subcontractor_id?: string | null
  /** Effective subcontractor after inheriting the closest ancestor assignment (migration 83). */
  resolved_subcontractor_id?: string | null
  quantity_certainty?: 'حدودی' | 'قطعی'
  unit_price?: number | null
  /** Commercial qty for leaf MSP activities (migration / hotfix 88). */
  quantity?: number | null
  /** Unit of measure for commercial quantity (hotfix 90). */
  uom?: string | null
  /** Display-only commercial qty for SEND preview (packages / synced leaves). */
  schedule_quantity?: number | null
  schedule_uom?: string | null
  /** Distinguishes MSP tasks from workshop زیرشاخه rows in SEND preview. */
  row_origin?: 'task' | 'package'
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  id: string
  project_id: string
  predecessor_task_id: string
  successor_task_id: string
  relation_type: TaskRelationType
  /** Lag in minutes (legacy MSP path) */
  lag_duration: number
  /** Lag in working days (migration 75) */
  lag_days?: number | null
  /** If true: warn and skip in CPM (migration 75) */
  lag_is_percentage?: boolean
  created_at: string
}

export interface ScheduleCalendar {
  id: string
  project_id: string
  name: string
  working_days: Record<string, boolean>
  daily_shifts: Array<{ start: string; end: string }>
  exceptions: unknown
  minutes_per_day: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ScheduleTaskSegment {
  id: string
  project_id: string
  activity_id: string
  segment_start: string
  segment_finish: string
  sort_order: number
  created_at: string
}

export interface ScheduleResource {
  id: string
  project_id: string
  external_id?: string | null
  name: string
  type: ScheduleResourceType
  standard_rate?: number | null
  unit_of_measure?: string | null
  max_units?: number | null
  calendar_id?: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleAssignment {
  id: string
  project_id: string
  activity_id: string
  resource_id: string
  units_percent?: number | null
  work_hours?: number | null
  cost?: number | null
  created_at: string
  updated_at: string
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

/** Summary from MSP import pre-validation (see lib/schedule/msp-import-validate). */
export interface MspImportReportSummary {
  totalActivities: number
  milestoneCount: number
  summaryCount: number
  manuallyScheduledCount: number
  splitCount: number
  recurringMasterCount: number
  percentLagCount: number
  openEndCount: number
  duplicateWbsCount: number
  weightMismatchCount: number
  unnamedResourceCount: number
  hasCycle: boolean
  blocked: boolean
  summaryLines: string[]
  issues: Array<{
    code: string
    severity: 'error' | 'warning'
    message: string
    activityNames?: string[]
    wbs?: string | null
  }>
}

export interface MspImportResult {
  import_id: string
  tasks_imported: number
  dependencies_imported: number
  baseline_start?: string
  needs_start_confirmation?: boolean
  dry_run?: boolean
  report?: MspImportReportSummary
}

export interface ProjectScheduleSummary {
  totalTasks: number
  completedTasks: number
  delayedTasks: number
  criticalTasks: number
  overallPercentComplete: number
  unresolvedAlerts: number
}
