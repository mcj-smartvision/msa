import { isQcActivityType, type QcActivityType } from '@/lib/qc-engine/activity-types'

export const QC_REQUEST_DRAFT_KEY = 'msa-qc-request-draft'

export type QcRequestDraft = {
  projectId: string
  code: string
  discipline: string
  topic: string
  elementType: string
  floor: string
  gridX: string
  gridY: string
  activityType: QcActivityType
  selectMode: 'exact' | 'range'
  rangeFrom: string
  rangeTo: string
  selectedIds: string[]
  sourceDrawingId: string
  voiceText: string
  typedSpeech: string
}

export function readQcRequestDraft(projectId: string): QcRequestDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(QC_REQUEST_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<QcRequestDraft>
    if (parsed.projectId !== projectId) return null
    return {
      projectId,
      code: String(parsed.code ?? ''),
      discipline: String(parsed.discipline ?? ''),
      topic: String(parsed.topic ?? ''),
      elementType: String(parsed.elementType ?? ''),
      floor: String(parsed.floor ?? ''),
      gridX: String(parsed.gridX ?? ''),
      gridY: String(parsed.gridY ?? ''),
      activityType: isQcActivityType(String(parsed.activityType ?? '')) ? (parsed.activityType as QcActivityType) : 'rebar',
      selectMode: parsed.selectMode === 'range' ? 'range' : 'exact',
      rangeFrom: String(parsed.rangeFrom ?? 'A'),
      rangeTo: String(parsed.rangeTo ?? 'C'),
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds.map(String) : [],
      sourceDrawingId: String(parsed.sourceDrawingId ?? ''),
      voiceText: String(parsed.voiceText ?? ''),
      typedSpeech: String(parsed.typedSpeech ?? ''),
    }
  } catch {
    return null
  }
}

export function writeQcRequestDraft(draft: QcRequestDraft) {
  sessionStorage.setItem(QC_REQUEST_DRAFT_KEY, JSON.stringify(draft))
}

export function clearQcRequestDraft(_projectId?: string) {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(QC_REQUEST_DRAFT_KEY)
}
