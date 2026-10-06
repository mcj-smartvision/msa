export type TransitDirection = 'IN' | 'OUT'
export type TransitSource = 'manual_guard' | 'manual_self' | 'qr' | 'camera' | 'admin'
export type IdentificationStatus = 'success' | 'failed' | 'unauthorized'
export type EmailDeliveryStatus = 'pending' | 'sent' | 'skipped' | 'failed'

export interface AttendanceGate {
  id: string
  projectId: string
  name: string
  cameraLabel: string | null
  cameraDeviceId: string | null
  cameraGroupId: string | null
  locationNote: string | null
  isActive: boolean
  sortOrder: number
}

export interface AttendanceEnrollmentSample {
  id: string
  pose: string
  labelFa: string
  labelEn: string
  imageUrl: string | null
}

export interface AttendanceEnrollment {
  id: string
  projectId: string
  userId: string
  imagePath: string
  personName: string | null
  enrolledBy: string | null
  isActive: boolean
  createdAt: string
  imageUrl?: string | null
  /** True when a biometric FaceNet embedding is stored */
  hasEmbedding?: boolean
  sampleCount?: number
  embeddingModel?: string | null
  samples?: AttendanceEnrollmentSample[]
}

export interface AttendanceTransit {
  id: string
  projectId: string
  userId: string | null
  gateId: string | null
  direction: TransitDirection
  source: TransitSource
  identificationStatus: IdentificationStatus
  personName: string | null
  personEmail: string | null
  personnelCode: string | null
  occurredAt: string
  recordedBy: string | null
  notes: string | null
  emailStatus: EmailDeliveryStatus
  emailSentAt: string | null
  emailError: string | null
  gateName?: string | null
}

export interface PresencePerson {
  userId: string
  fullName: string
  email: string | null
  personnelCode: string | null
  status: 'inside' | 'outside' | 'absent'
  lastDirection: TransitDirection | null
  lastTransitAt: string | null
  officialEntryAt: string | null
  officialExitAt: string | null
  outsideMsToday: number
  transitCountToday: number
}

export interface AttendanceDashboardSnapshot {
  date: string
  gates: AttendanceGate[]
  recentTransits: AttendanceTransit[]
  failedTransits: AttendanceTransit[]
  inside: PresencePerson[]
  outsideToday: PresencePerson[]
  absent: PresencePerson[]
  kpis: {
    insideCount: number
    outsideCount: number
    absentCount: number
    transitCountToday: number
    failedCountToday: number
  }
}

export interface RecordTransitInput {
  projectId: string
  userId?: string | null
  gateId?: string | null
  /** If omitted and user is known, auto from last successful transit */
  direction?: TransitDirection | null
  source?: TransitSource
  identificationStatus?: IdentificationStatus
  personName?: string | null
  notes?: string | null
  occurredAt?: string | null
}

export interface CreateGateInput {
  projectId: string
  name: string
  cameraLabel?: string | null
  locationNote?: string | null
}

export interface BindGateCameraInput {
  projectId: string
  gateId: string
  cameraDeviceId: string
  cameraLabel?: string | null
  cameraGroupId?: string | null
}

export interface EnrollPersonInput {
  projectId: string
  userId: string
  personName?: string | null
  /**
   * Guided multi-pose samples (preferred).
   * Server averages embeddings and stores each crop.
   */
  samples?: Array<{
    imageBase64: string
    faceEmbedding: number[]
    pose: string
    mimeType?: string
  }>
  /** Legacy single-image enroll */
  imageBase64?: string
  mimeType?: string
  faceEmbedding?: number[]
  embeddingModel?: string
  sampleCount?: number
}
