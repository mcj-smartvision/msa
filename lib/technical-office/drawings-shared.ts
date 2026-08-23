export const DRAWING_MAX_FILES = 20
export const DRAWING_EXTENSIONS = ['pdf', 'dwg'] as const

export type DrawingFormat = (typeof DRAWING_EXTENSIONS)[number]

export type ProjectDrawing = {
  id: string
  projectId: string
  title: string
  fileName: string
  fileSize: number | null
  format: DrawingFormat
  createdAt: string
  uploadedBy: string | null
}
