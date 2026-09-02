export const QC_REJECTED_AT_MARKER = 'QC_REJECTED_AT'
export const QC_APPROVED_AT_MARKER = 'QC_APPROVED_AT'
export const QC_RESUBMIT_MARKER = 'QC_RESUBMIT'

export type InspectorVerdictInferenceInput = {
  status: string
  inspectorVerdict?: 'approved' | 'rejected' | null
  notes?: string | null
  inspectorNotes?: string | null
  inspectorClassified?: string | null
  lastRejectedAt?: string | null
  updatedAt?: string | null
  history?: { eventType: string; occurredAt: string }[]
}

export function inferInspectorVerdictFromRequest(input: InspectorVerdictInferenceInput) {
  if (input.inspectorVerdict === 'approved' || input.inspectorVerdict === 'rejected') {
    return input.inspectorVerdict
  }

  const status = String(input.status)
  if (status === 'draft' || status === 'cancelled') return null

  const history = input.history ?? []
  const rejectedHistory = history.filter((entry) => entry.eventType === 'rejected').pop()
  const approvedHistory = history.filter((entry) => entry.eventType === 'approved').pop()
  const resubmittedHistory = history.filter((entry) => entry.eventType === 'resubmitted').pop()
  const resubmitAt = resubmittedHistory?.occurredAt ?? parseQcNoteMarker(input.notes, QC_RESUBMIT_MARKER)

  function isAfterResubmit(at: string | null | undefined) {
    if (!at || !resubmitAt) return false
    return new Date(resubmitAt).getTime() > new Date(at).getTime()
  }

  if (rejectedHistory && approvedHistory) {
    const rejectedAt = rejectedHistory.occurredAt
    const approvedAt = approvedHistory.occurredAt
    const verdict =
      new Date(rejectedAt).getTime() >= new Date(approvedAt).getTime() ? 'rejected' : 'approved'
    const decisionAt = verdict === 'rejected' ? rejectedAt : approvedAt
    if (isAfterResubmit(decisionAt)) return null
    return verdict
  }
  if (rejectedHistory && !isAfterResubmit(rejectedHistory.occurredAt)) return 'rejected'
  if (approvedHistory && status === 'completed' && !isAfterResubmit(approvedHistory.occurredAt)) {
    return 'approved'
  }

  const notes = input.notes ?? null
  const rejectedMarker = parseQcNoteMarker(notes, QC_REJECTED_AT_MARKER)
  const approvedMarker = parseQcNoteMarker(notes, QC_APPROVED_AT_MARKER)

  if (rejectedMarker && approvedMarker) {
    const verdict =
      new Date(rejectedMarker).getTime() >= new Date(approvedMarker).getTime() ? 'rejected' : 'approved'
    const decisionAt = verdict === 'rejected' ? rejectedMarker : approvedMarker
    if (isAfterResubmit(decisionAt)) return null
    return verdict
  }
  if (rejectedMarker && !isAfterResubmit(rejectedMarker)) return 'rejected'
  if (approvedMarker && status === 'completed' && !isAfterResubmit(approvedMarker)) return 'approved'

  if (input.lastRejectedAt && !isAfterResubmit(input.lastRejectedAt)) return 'rejected'

  if (status === 'completed') {
    const combined = [input.notes, input.inspectorNotes, input.inspectorClassified].filter(Boolean).join('\n')
    if (/نتیجه:\s*رد|رد\s*بازرس|قابل\s*قبول\s*نیست|عدم\s*قبول/i.test(combined)) return 'rejected'
    if (/نتیجه:\s*تأیید|نتیجه:\s*تایید|تأیید\s*بازرس|تایید\s*بازرس/i.test(combined)) return 'approved'
    if (input.inspectorNotes && /^رد[\s.:،-]/i.test(input.inspectorNotes.trim())) return 'rejected'
  }

  return null
}

export function inferLastRejectedAtFromRequest(input: InspectorVerdictInferenceInput) {
  if (input.lastRejectedAt) return input.lastRejectedAt
  const fromMarker = parseQcNoteMarker(input.notes, QC_REJECTED_AT_MARKER)
  if (fromMarker) return fromMarker
  const history = input.history ?? []
  const rejected = history.filter((entry) => entry.eventType === 'rejected').pop()
  return rejected?.occurredAt ?? null
}

export function inferApprovedAtFromRequest(input: InspectorVerdictInferenceInput) {
  const approvedMarker = parseQcNoteMarker(input.notes, QC_APPROVED_AT_MARKER)
  if (approvedMarker) return approvedMarker
  const history = input.history ?? []
  const approved = history.filter((entry) => entry.eventType === 'approved').pop()
  if (approved?.occurredAt) return approved.occurredAt
  // Legacy: approval timestamp was stored under reject marker before QC_APPROVED_AT existed
  if (input.inspectorVerdict === 'approved') {
    const legacyMarker = parseQcNoteMarker(input.notes, QC_REJECTED_AT_MARKER)
    if (legacyMarker) return legacyMarker
    if (input.updatedAt) return input.updatedAt
  }
  return null
}

export function appendQcNoteMarker(notes: string | null | undefined, key: string, iso: string) {
  const base = (notes ?? '').replace(new RegExp(`\\[${key}:[^\\]]+\\]`, 'g'), '').trim()
  const marker = `[${key}:${iso}]`
  return base ? `${base}\n${marker}` : marker
}

export function parseQcNoteMarker(notes: string | null | undefined, key: string) {
  if (!notes) return null
  const matches = [...notes.matchAll(new RegExp(`\\[${key}:([^\\]]+)\\]`, 'g'))]
  return matches.length ? matches[matches.length - 1][1] : null
}

export function hasQcNoteMarker(notes: string | null | undefined, key: string) {
  return Boolean(notes?.includes(`[${key}:`))
}
