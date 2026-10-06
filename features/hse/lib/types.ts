/** HSE camera-safety operations — shared types (English UI module). */

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type IncidentStatus =
  | 'new'
  | 'acknowledged'
  | 'ai_review'
  | 'confirmed'
  | 'dismissed'
  | 'escalated'
  | 'assigned'
  | 'closed'

export type CameraHealth = 'online' | 'degraded' | 'offline' | 'calibrating'
export type CameraSource = 'rtsp' | 'onvif' | 'nvr' | 'edge_usb'
export type ZoneRisk = 'critical' | 'high' | 'medium' | 'low'
export type AlertChannel = 'telegram' | 'email' | 'webhook'
export type DecisionAction =
  | 'acknowledge'
  | 'confirm'
  | 'dismiss'
  | 'escalate'
  | 'assign'
  | 'close'
  | 'ai_verify'
  | 'note'

export interface HseProject {
  id: string
  name: string
  code: string
  location: string
}

export interface HseContractor {
  id: string
  name: string
  trade: string
  openIncidents: number
  confirmedViolations: number
  falsePositives: number
}

export interface HseUser {
  id: string
  name: string
  role: 'employer' | 'hse_officer' | 'technical_admin' | 'supervisor'
  email: string
}

export interface HseCamera {
  id: string
  name: string
  code: string
  health: CameraHealth
  sourceType: CameraSource
  location: string
  lastHeartbeat: string
  zoneIds: string[]
  fps: number
  resolution: string
  calibration: {
    tiltDeg: number
    panDeg: number
    zoom: number
    roiNotes: string
  }
}

export interface HseZone {
  id: string
  name: string
  code: string
  risk: ZoneRisk
  cameraIds: string[]
  ruleIds: string[]
  notes: string
  areaLabel: string
}

export interface HseRule {
  id: string
  name: string
  code: string
  severity: Severity
  confidenceThreshold: number
  durationThresholdSec: number
  cooldownSec: number
  zoneIds: string[]
  enabled: boolean
  description: string
  category: string
}

export interface EvidenceFrame {
  id: string
  label: string
  timestamp: string
  caption: string
}

export interface DecisionLogEntry {
  id: string
  at: string
  actor: string
  action: DecisionAction
  note: string
}

export interface CorrectiveAction {
  id: string
  title: string
  owner: string
  dueDate: string
  status: 'open' | 'in_progress' | 'done'
}

export interface HseIncident {
  id: string
  code: string
  title: string
  projectId: string
  zoneId: string
  cameraId: string
  ruleId: string
  contractorId: string | null
  severity: Severity
  status: IncidentStatus
  confidence: number
  detectedAt: string
  updatedAt: string
  assignee: string | null
  aiSummary: string
  aiVerdict: 'likely_violation' | 'uncertain' | 'likely_false_positive'
  aiConfidence: number
  evidenceFrames: EvidenceFrame[]
  clipPlaceholder: string
  decisionLog: DecisionLogEntry[]
  correctiveActions: CorrectiveAction[]
  falsePositive: boolean
}

export interface AlertLogEntry {
  id: string
  at: string
  channel: AlertChannel
  severity: Severity
  target: string
  incidentCode: string
  result: 'sent' | 'failed' | 'queued'
  detail: string
}

export interface AlertRouting {
  severity: Severity
  telegram: boolean
  email: boolean
  webhook: boolean
}

export interface OverviewKpis {
  totalIncidents: number
  activeIncidents: number
  confirmedViolations: number
  falsePositives: number
  avgAckMinutes: number
  avgCloseHours: number
  camerasOnline: number
  camerasTotal: number
}
