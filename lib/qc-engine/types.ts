export type QcRequestStatus =
  | 'draft'
  | 'submitted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type QcInspectorVerdict = 'approved' | 'rejected'
export type QcInspectionHistoryEvent = 'submitted' | 'rejected' | 'approved' | 'resubmitted'
export type QcVerdict = 'pass' | 'fail' | 'na'
export type QcNcrSeverity = 'minor' | 'major' | 'critical'
export type QcNcrStatus = 'open' | 'in_progress' | 'pending_verify' | 'closed' | 'waived'
export type QcRequestPriority = 'high' | 'medium' | 'low'

export const DEFAULT_QC_REQUEST_PRIORITY: QcRequestPriority = 'medium'

export function parseQcRequestPriority(value: unknown): QcRequestPriority {
  return value === 'high' || value === 'low' ? value : DEFAULT_QC_REQUEST_PRIORITY
}

export type QcInspectableItem = {
  id: string
  projectId: string
  code: string
  name: string | null
  disciplineKey: string
  topicKey: string
  elementTypeKey: string
  floor: string | null
  gridRef: string | null
  gridX: string | null
  gridY: string | null
}

export type QcRequestDrawing = {
  id: string
  requestId: string
  sourceDrawingId: string | null
  fileName: string
  contentType: string | null
  url: string | null
  kind?: 'marked' | 'office'
}

export type QcInspectionRequestHistoryEntry = {
  id: string
  requestId: string
  eventType: QcInspectionHistoryEvent
  occurredAt: string
  actorId: string | null
  activityType: string | null
  floor: string | null
  gridFrom: string | null
  gridTo: string | null
  requestNotes: string | null
  inspectorNotes: string | null
  inspectorClassified: string | null
  itemCodes: string[]
  cycleNumber: number
}

export type QcInspectionRequest = {
  id: string
  projectId: string
  activityType: string
  requestedAt: string
  createdAt: string
  status: QcRequestStatus
  notes: string | null
  floor: string | null
  gridFrom: string | null
  gridTo: string | null
  sourceDrawingId: string | null
  sourceDrawingTitle: string | null
  requestedByName: string | null
  itemIds: string[]
  itemCodes: string[]
  drawings: QcRequestDrawing[]
  inspectorVerdict: QcInspectorVerdict | null
  inspectorNotes: string | null
  inspectorClassified: string | null
  priority: QcRequestPriority
  firstSubmittedAt: string | null
  lastRejectedAt: string | null
  updatedAt: string | null
  reinspectCount: number
  history: QcInspectionRequestHistoryEntry[]
}

export type QcChecklistRow = {
  id: string
  code: string | null
  prompt: string
  sortOrder: number
  verdict: QcVerdict | null
  resultId: string | null
  notes: string | null
}

export type QcResultPhoto = {
  id: string
  requestId: string
  resultId: string
  itemId: string
  itemCode: string
  storageRef: string
  url: string | null
  caption: string | null
  mediaKind: 'image' | 'video'
}

export type QcEngineNcr = {
  id: string
  ncrNumber: string
  title: string
  itemCode: string
  severity: QcNcrSeverity
  status: QcNcrStatus
  createdAt: string
}

export type QcOfficeDrawing = {
  id: string
  title: string
  fileName: string
  format: string
}

export type QcEngineDashboard = {
  items: QcInspectableItem[]
  requests: QcInspectionRequest[]
  photos: QcResultPhoto[]
  ncrs: QcEngineNcr[]
  officeDrawings: QcOfficeDrawing[]
}
