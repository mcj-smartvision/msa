export const QC_DRAWING_DISCIPLINES = ['structure', 'architecture', 'electrical', 'mechanical'] as const

export type QcDrawingDiscipline = (typeof QC_DRAWING_DISCIPLINES)[number]

export const QC_SELECTED_DRAWINGS_KEY = 'msa-qc-selected-drawings'

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
    const parsed = JSON.parse(raw) as { projectId?: string; ids?: string[] }
    if (parsed.projectId !== projectId) return []
    return Array.isArray(parsed.ids) ? parsed.ids.map(String) : []
  } catch {
    return []
  }
}

export function writeQcSelectedDrawings(projectId: string, ids: string[]) {
  sessionStorage.setItem(QC_SELECTED_DRAWINGS_KEY, JSON.stringify({ projectId, ids }))
}
