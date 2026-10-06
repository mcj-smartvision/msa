/** Site Supervisor dashboard domain types */

export type AiStatus = 'draft_by_ai' | 'confirmed_by_user' | 'rejected_by_user'

export type PlannedStatus = 'shouldStart' | 'shouldContinue' | 'shouldFinish'
export type ActualStatus = 'notStarted' | 'started' | 'finished'
export type QualityStatus = 'good' | 'acceptable' | 'problematic'
export type ReadinessLevel = 'ok' | 'warning' | 'critical'
export type IssueType = 'material' | 'manpower' | 'equipment' | 'permit' | 'other'

export type AiActionType =
  | 'subcontractor_instruction'
  | 'purchase_request'
  | 'pm_comment'
  | 'hse_alert'

export interface ReadinessStatus {
  materials: ReadinessLevel
  manpower: ReadinessLevel
  access: ReadinessLevel
}

export interface TodayActivity {
  id: string
  kind: 'schedule' | 'package'
  parentId?: string | null
  depth: number
  wbs_code: string
  name: string
  location?: string
  is_critical: boolean
  planned_status: PlannedStatus
  actual_status: ActualStatus
  actual_progress_percent: number
  readiness: ReadinessStatus
  subcontractor_name?: string
  /** Workshop sub-branch (دفتر فنی) */
  packageId?: string
  assignmentId?: string | null
  quantity?: number
  uom?: string
  plannedQtyToday?: number | null
  approvalStatus?: string
  workshopNote?: string | null
}

export interface LookaheadActivity {
  id: string
  wbs_code: string
  name: string
  date_planned_start: string
  is_critical: boolean
  materials_ready: ReadinessLevel
  drawings_approved: ReadinessLevel
  subcontractor_assigned: ReadinessLevel
}

export interface MaterialResourceRow {
  id: string
  name: string
  current_stock: number
  unit: string
  min_stock: number
  estimated_7d_consumption: number
  status: ReadinessLevel
}

export interface ManpowerSummary {
  crews_available: number
  crews_needed: number
  shortage_note?: string
}

export interface EquipmentRow {
  id: string
  name: string
  status: 'available' | 'in_use' | 'maintenance' | 'conflict'
  note?: string
}

export interface ResourceSummary {
  materials: MaterialResourceRow[]
  manpower: ManpowerSummary
  equipment: EquipmentRow[]
}

export interface SupervisorIssue {
  id: string
  title: string
  related_task_id?: string
  related_task_name?: string
  type: IssueType
  description: string
  status: 'open' | 'closed'
  created_at: string
}

export interface AiActionRow {
  id: string
  type: AiActionType
  project_id: string
  supervisor_id: string
  related_task_id: string | null
  payload: Record<string, unknown>
  text_generated: string
  status: AiStatus
  pm_status?: 'not_required' | 'pending' | 'approved' | 'rejected'
  pm_reviewed_by?: string | null
  pm_reviewed_at?: string | null
  pm_rejection_reason?: string | null
  procurement_status?:
    | 'not_applicable'
    | 'pending'
    | 'sourcing'
    | 'rfq_sent'
    | 'po_issued'
    | 'in_transit'
    | 'received'
    | 'cancelled'
  created_by: string
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
}

export interface SupervisorKpis {
  plannedPercentToday: number
  actualPercentToday: number
  delayDays: number
  forecastLabel: string
  forecastRisk: 'low' | 'medium' | 'high'
  todayActivitiesTotal: number
  todayCritical: number
  todayOverdue: number
  readinessScore: number
}

export interface DailyReportActivityInput {
  scheduleActivityId: string
  plannedStatus: PlannedStatus
  actualStatus: ActualStatus
  actualProgressPercent: number
  qualityStatus: QualityStatus
  issues: { type: IssueType; description?: string }[]
}

export interface DailyReportInput {
  date: string
  shift: 'morning' | 'evening' | 'night'
  siteId: string
  supervisorId: string
  activities: DailyReportActivityInput[]
  resourcesSummary: {
    materialAlerts: { materialName: string; status: ReadinessLevel; note?: string }[]
    manpowerAlert?: { hasShortage: boolean; note?: string }
    equipmentAlert?: { hasIssue: boolean; note?: string }
  }
  hse: { hasIncident: boolean; description?: string }
  supervisorNote?: string
}

export interface PurchaseRequestPayload {
  material_name: string
  quantity: number
  unit: string
  needed_date: string
  priority: 'normal' | 'urgent' | 'critical'
  reason: string
}
