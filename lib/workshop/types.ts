export type WorkshopPackageStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'partial'
  | 'done'
  | 'blocked'
  | 'needs_review'

export type WorkshopApprovalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'change_requested'

export type WorkshopAssignmentStatus = 'planned' | 'partial' | 'done' | 'blocked'
export type WorkshopActualStatus = 'done' | 'partial' | 'blocked'

export interface PackageChangePayload {
  name?: string
  location?: string | null
  quantity?: number
  uom?: string
  crew?: string | null
  note?: string | null
}

export type ReviewReasonCode =
  | 'out_of_baseline_scope'
  | 'missing_quantity_basis'
  | 'missing_uom'
  | 'resource_unclear'
  | 'needs_technical_mapping'
  | 'other'

export const WORKSHOP_UOMS = ['m2', 'm3', 'm', 'ton', 'ea', 'ls', 'kg', 'hr'] as const

export interface ScheduleTreeNode {
  id: string
  kind: 'schedule'
  mspUid: number | null
  /** Real project_tasks.id; null for synthetic WBS group rows */
  taskId: string | null
  /** Complete source activity used by the full-column schedule editor. */
  task?: import('@/types/schedule').ProjectTask
  wbs: string | null
  name: string
  depth: number
  /** Summary/group row derived from WBS prefix (not editable, no packages) */
  isSyntheticGroup?: boolean
  startDate: string | null
  finishDate: string | null
  /** MSP activity weight (وزن) from project_tasks.schedule_weight */
  scheduleWeight?: number | null
  /** Imported / catch-up percent from project_tasks.percent_complete */
  percentComplete?: number
  /** Latest CPM / manual total float (days) from schedule_calculations */
  totalFloat?: number | null
  /** MSP predecessor labels e.g. "1.2FS, 1.3SS+2d" */
  predecessorLabel?: string | null
  /** Full Persian explanation(s) for hover on پیش‌نیاز */
  predecessorTooltip?: string | null
  packages: WorkshopPackageNode[]
  children: ScheduleTreeNode[]
}

export interface WorkshopPackageNode {
  id: string
  kind: 'package'
  /** Hierarchical code under parent schedule WBS, e.g. 2.1.1 */
  wbs: string | null
  name: string
  location: string | null
  quantity: number
  quantityCertainty: 'حدودی' | 'قطعی'
  unitPrice: number
  uom: string
  crew: string | null
  note: string | null
  status: WorkshopPackageStatus
  approvalStatus: WorkshopApprovalStatus
  lastPmComment: string | null
  pendingChange: PackageChangePayload | null
  flagForReview: boolean
  reviewReason: string | null
  /** User-entered weight for this sub-branch */
  weightPercent: number | null
  origin: string | null
  /** Own schedule dates (ISO YYYY-MM-DD); null → inherit parent */
  startDate: string | null
  finishDate: string | null
  /** Direct contractor override; null means inherit from parent. */
  subcontractorId?: string | null
  /** Effective contractor after inheritance. */
  resolvedSubcontractorId?: string | null
  /** Values for the extended schedule columns shown in the unified table. */
  scheduleFields?: Record<string, unknown>
  children: WorkshopPackageNode[]
}

export interface UpdatePackageInput {
  name?: string
  quantity?: number
  quantityCertainty?: 'حدودی' | 'قطعی'
  unitPrice?: number
  uom?: string
  location?: string | null
  crew?: string | null
  note?: string | null
  flagForReview?: boolean
  reviewReason?: string | null
  weightPercent?: number | null
  startDate?: string | null
  finishDate?: string | null
  subcontractorId?: string | null
  scheduleFields?: Record<string, unknown>
}

export interface CreatePackageInput {
  projectId: string
  parentScheduleNodeId?: string | null
  parentPackageId?: string | null
  name: string
  quantity: number
  quantityCertainty?: 'حدودی' | 'قطعی'
  unitPrice?: number
  uom: string
  location?: string | null
  crew?: string | null
  note?: string | null
  flagForReview?: boolean
  reviewReason?: string | null
  /** Client-computed WBS preview (e.g. 4.6.1); stored for stable references */
  wbsCode?: string | null
  /** User-entered weight */
  weightPercent?: number | null
  startDate?: string | null
  finishDate?: string | null
  subcontractorId?: string | null
  scheduleFields?: Record<string, unknown>
}
