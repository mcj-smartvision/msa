export const QC_DRAWING_DISCIPLINES = ['structure', 'architecture', 'electrical', 'mechanical'] as const

export type QcDrawingDiscipline = (typeof QC_DRAWING_DISCIPLINES)[number]

export const QC_SELECTED_DRAWINGS_KEY = 'msa-qc-selected-drawings-v2'
export const QC_BLOCK_CREATE_KEY = 'msa-qc-block-create-until'

const RULES: { key: QcDrawingDiscipline; pattern: RegExp }[] = [
  { key: 'architecture', pattern: /معمار|architect|\barch\b/i },
  { key: 'electrical', pattern: /برق|electr|\belec\b|lighting|\bpower\b/i },
  { key: 'mechanical', pattern: /مکانیک|تاسیسات|تأسیسات|mechanical|hvac|plumb|\bmech\b/i },
  { key: 'structure', pattern: /سازه|structur|steel|rebar|concrete|bdaz|column|beam/i },
]

export function classifyDrawingDiscipline(title: string, fileName: string): QcDrawingDiscipline {
  const text = `${title} ${fileName}`
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.key
  }
  return 'structure'
}

export function readQcSelectedDrawings(projectId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(QC_SELECTED_DRAWINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { projectId?: string; ids?: string[]; pendingApply?: boolean }
    if (parsed.projectId !== projectId) return []
    return Array.isArray(parsed.ids) ? parsed.ids.map(String) : []
  } catch {
    return []
  }
}

export function writeQcSelectedDrawings(projectId: string, ids: string[]) {
  sessionStorage.setItem(
    QC_SELECTED_DRAWINGS_KEY,
    JSON.stringify({ projectId, ids, pendingApply: true })
  )
  blockQcRequestCreate(1800)
}

export function consumeQcSelectedDrawings(projectId: string): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(QC_SELECTED_DRAWINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { projectId?: string; ids?: string[]; pendingApply?: boolean }
    if (parsed.projectId !== projectId || !parsed.pendingApply) return null
    const ids = Array.isArray(parsed.ids) ? parsed.ids.map(String) : []
    sessionStorage.setItem(QC_SELECTED_DRAWINGS_KEY, JSON.stringify({ projectId, ids, pendingApply: false }))
    blockQcRequestCreate(1500)
    return ids
  } catch {
    return null
  }
}

export function blockQcRequestCreate(ms: number) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(QC_BLOCK_CREATE_KEY, String(Date.now() + ms))
}

export function qcRequestCreateBlockedUntil() {
  if (typeof window === 'undefined') return 0
  const until = Number(sessionStorage.getItem(QC_BLOCK_CREATE_KEY) || 0)
  return Number.isFinite(until) ? until : 0
}

export function isQcRequestCreateBlocked() {
  return Date.now() < qcRequestCreateBlockedUntil()
}

export function hasPendingQcDrawingApply() {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(QC_SELECTED_DRAWINGS_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { pendingApply?: boolean }
    return parsed.pendingApply === true
  } catch {
    return false
  }
}

export function initialQcCreateBlockUntil() {
  if (typeof window === 'undefined') return 0
  if (hasPendingQcDrawingApply() || isQcRequestCreateBlocked()) {
    return Math.max(Date.now() + 1500, qcRequestCreateBlockedUntil())
  }
  return Date.now() + 800
}

export function clearQcSelectedDrawings() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(QC_SELECTED_DRAWINGS_KEY)
}
