export type QcRequestStatus =
  | 'draft'
  | 'submitted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type QcVerdict = 'pass' | 'fail' | 'na'
export type QcNcrSeverity = 'minor' | 'major' | 'critical'
export type QcNcrStatus = 'open' | 'in_progress' | 'pending_verify' | 'closed' | 'waived'

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

export type QcInspectionRequest = {
  id: string
  projectId: string
  activityType: string
  requestedAt: string
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
  resultId: string
  itemId: string
  itemCode: string
  storageRef: string
  url: string | null
  caption: string | null
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
