export const DRAWING_MAX_FILES = 20
export const DRAWING_EXTENSIONS = ['pdf', 'dwg'] as const

export type DrawingFormat = (typeof DRAWING_EXTENSIONS)[number]

export type DrawingDiscipline =
  | 'structure'
  | 'architecture'
  | 'mechanical'
  | 'electrical'
  | 'other'

export type ProjectDrawing = {
  id: string
  projectId: string
  title: string
  fileName: string
  fileSize: number | null
  format: DrawingFormat
  discipline: DrawingDiscipline
  createdAt: string
  uploadedBy: string | null
}

/** مسیر inline برای پیش‌نمایش در داشبورد */
export function projectDrawingPreviewPath(drawingId: string): string {
  return `/api/technical-office/drawings/${encodeURIComponent(drawingId)}/file`
}
