import type { DrawingDiscipline } from '@/features/technical-office/lib/drawings-shared'

const LABELS: Record<DrawingDiscipline, string> = {
  structure: 'سازه',
  architecture: 'معماری',
  mechanical: 'مکانیک',
  electrical: 'برق',
  other: 'سایر',
}

export function drawingDisciplineLabel(discipline: DrawingDiscipline): string {
  return LABELS[discipline]
}

export const DRAWING_DISCIPLINE_OPTIONS: DrawingDiscipline[] = [
  'structure',
  'architecture',
  'electrical',
  'mechanical',
  'other',
]

/** تب‌های ثابت لیست نقشه در دفتر فنی — بدون «سایر» */
export const DRAWING_LIST_TAB_DISCIPLINES: DrawingDiscipline[] = [
  'structure',
  'architecture',
  'electrical',
  'mechanical',
]

/** استنتاج رشته از عنوان/نام فایل — برای نقشه‌های قبلی بدون فیلد رشته */
export function inferDrawingDiscipline(input: {
  title?: string
  fileName?: string
  discipline?: DrawingDiscipline | null
}): DrawingDiscipline {
  if (
    input.discipline &&
    input.discipline !== 'other' &&
    DRAWING_DISCIPLINE_OPTIONS.includes(input.discipline)
  ) {
    return input.discipline
  }

  const title = (input.title ?? '').trim()

  if (/^معماری(\s|[—\-–]|$)/.test(title)) return 'architecture'
  if (/^سازه(\s|[—\-–]|$)/.test(title)) return 'structure'
  if (/^برق(\s|[—\-–]|$)/.test(title)) return 'electrical'
  if (/^مکانیک(\s|[—\-–]|$)/.test(title)) return 'mechanical'

  const blob = `${title} ${input.fileName ?? ''}`.toLowerCase()

  if (
    /\bstr\b|سازه|structural|steel|فولاد/.test(blob) ||
    blob.includes('ستون') ||
    blob.includes('دال')
  ) {
    return 'structure'
  }
  if (
    /\barc\b|معمار|architect|نما|پلان/.test(blob) ||
    blob.includes('معماری')
  ) {
    return 'architecture'
  }
  if (
    /\bmep-e\b|\belec\b|برق|electrical|روشنایی|کابل/.test(blob) ||
    blob.includes('تابلو')
  ) {
    return 'electrical'
  }
  if (
    /\bmep-m\b|مکانیک|mechanical|hvac|تهویه|لوله/.test(blob) ||
    blob.includes('داکت')
  ) {
    return 'mechanical'
  }

  return input.discipline === 'other' ? 'structure' : input.discipline ?? 'structure'
}
