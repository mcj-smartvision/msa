import type { ProjectTask } from '@/shared/types/schedule'

export type InspectionStatus = 'pending' | 'passed' | 'passed_with_comments' | 'failed'
export type NcrStatus = 'draft_by_ai' | 'open' | 'under_review' | 'closed' | 'rejected'

export interface ChecklistItem {
  item: string
  ok: boolean
  note?: string
}

export interface QualityInspection {
  id: string
  activityId: string
  activityName: string
  wbsCode: string
  location: string
  inspectorName?: string
  status: InspectionStatus
  priority: 'low' | 'medium' | 'high' | 'critical'
  checklistResults: ChecklistItem[]
  comments?: string
  inspectedAt?: string
  plannedDate?: string
}

export interface NcrRecord {
  id: string
  ncrNumber: string
  title: string
  relatedActivity?: string
  severity: 'low' | 'medium' | 'high'
  status: NcrStatus
  aiGeneratedOfficialText: string
  formalText?: string
  correctiveActionRequired?: string
  createdAt: string
}

export interface LabTestRecord {
  id: string
  testType: 'concrete_compression' | 'steel_tensile' | 'other'
  sampleId: string
  testDate: string
  location: string
  requiredValue: number
  actualValue: number
  unit: string
  pass: boolean
  remarks?: string
}

export interface QcKpis {
  passRate: number
  openNcrCount: number
  pendingInspections: number
  failedTests: number
  resolvedIssues: number
  todayInspections: number
  highSeverityFindings: number
}

export const DEFAULT_CHECKLIST: string[] = [
  'Drawings & specs available on site',
  'Materials conform to approved submittals',
  'Workmanship meets specification',
  'Dimensions & alignment verified',
  'Safety access & housekeeping acceptable',
]

export function taskToPendingInspection(task: ProjectTask): QualityInspection {
  const isCritical = task.is_critical
  return {
    id: `pending-${task.id}`,
    activityId: task.id,
    activityName: task.name,
    wbsCode: task.wbs_code ?? '—',
    location: task.wbs_code ?? 'Site',
    status: 'pending',
    priority: isCritical ? 'critical' : task.percent_complete >= 50 ? 'high' : 'medium',
    checklistResults: DEFAULT_CHECKLIST.map((item) => ({ item, ok: true })),
    plannedDate: (task.finish_current ?? task.finish_planned)?.slice(0, 10),
  }
}

export function computeQcKpis(
  inspections: QualityInspection[],
  ncrs: NcrRecord[],
  labTests: LabTestRecord[]
): QcKpis {
  const completed = inspections.filter((i) => i.status !== 'pending')
  const passed = completed.filter((i) => i.status === 'passed' || i.status === 'passed_with_comments')
  const today = new Date().toISOString().slice(0, 10)
  const openNcrs = ncrs.filter((n) => n.status !== 'closed' && n.status !== 'rejected')

  return {
    passRate: completed.length ? Math.round((passed.length / completed.length) * 100) : 100,
    openNcrCount: openNcrs.length,
    pendingInspections: inspections.filter((i) => i.status === 'pending').length,
    failedTests: labTests.filter((t) => !t.pass).length,
    resolvedIssues: ncrs.filter((n) => n.status === 'closed').length,
    todayInspections: completed.filter((i) => i.inspectedAt?.slice(0, 10) === today).length,
    highSeverityFindings:
      openNcrs.filter((n) => n.severity === 'high').length +
      inspections.filter((i) => i.status === 'failed').length,
  }
}
