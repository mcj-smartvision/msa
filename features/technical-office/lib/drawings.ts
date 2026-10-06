import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/shared/lib/supabase/service'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import type { DrawingDiscipline, DrawingFormat, ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'
import { inferDrawingDiscipline } from '@/features/technical-office/lib/drawing-discipline'

export type { DrawingFormat, ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'
export { DRAWING_MAX_FILES } from '@/features/technical-office/lib/drawings-shared'

export const DRAWINGS_BUCKET = 'project-drawings'
export const DRAWING_MAX_BYTES = 25 * 1024 * 1024

type DrawingMeta = {
  title: string
  fileName: string
  fileSize: number
  format: DrawingFormat
  discipline?: DrawingDiscipline
  uploadedBy: string | null
  createdAt: string
}

const DRAWING_ALLOWED_MIMES = [
  'application/pdf',
  'application/json',
  'application/acad',
  'application/x-acad',
  'application/dwg',
  'application/x-dwg',
  'application/x-autocad',
  'image/vnd.dwg',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/octet-stream',
]

export function canUploadProjectDrawings(context: DashboardUserContext): boolean {
  return (
    context.isSystemAdmin ||
    context.positionKeys.includes('technical_office') ||
    context.positionKeys.includes('project_manager')
  )
}

export function canViewProjectDrawings(context: DashboardUserContext): boolean {
  return (
    canUploadProjectDrawings(context) ||
    context.positionKeys.includes('site_supervisor') ||
    context.positionKeys.includes('site_manager') ||
    context.positionKeys.includes('qa_qc_inspector')
  )
}

export function isMissingDrawingsTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    /schema cache|project_drawings/i.test(error.message ?? '')
  )
}

export function getDrawingFormat(file: { name: string; type?: string }): DrawingFormat | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf'
  if (
    name.endsWith('.dwg') ||
    /dwg|acad|autocad/i.test(file.type ?? '')
  ) {
    return 'dwg'
  }
  return null
}

export function drawingContentType(format: DrawingFormat) {
  return format === 'pdf' ? 'application/pdf' : 'image/vnd.dwg'
}

export function getDrawingsStorage(): SupabaseClient {
  return createServiceClient()
}

export async function ensureDrawingsBucket(storage: SupabaseClient) {
  const { data } = await storage.storage.listBuckets()
  const exists = (data ?? []).some((bucket) => bucket.name === DRAWINGS_BUCKET)
  if (!exists) {
    const { error } = await storage.storage.createBucket(DRAWINGS_BUCKET, {
      public: false,
      fileSizeLimit: DRAWING_MAX_BYTES,
      allowedMimeTypes: DRAWING_ALLOWED_MIMES,
    })
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(
        /not configured|service role/i.test(error.message)
          ? 'کلید سرویس سوپابیس تنظیم نشده است.'
          : error.message
      )
    }
    return
  }

  await storage.storage.updateBucket(DRAWINGS_BUCKET, {
    public: false,
    fileSizeLimit: DRAWING_MAX_BYTES,
    allowedMimeTypes: DRAWING_ALLOWED_MIMES,
  })
}

function drawingPaths(projectId: string, id: string, format: DrawingFormat = 'pdf') {
  return {
    file: `${projectId}/${id}.${format}`,
    meta: `${projectId}/${id}.json`,
  }
}

export function parseDrawingId(raw: string): { projectId: string; id: string } | null {
  const value = decodeURIComponent(raw)
  const match = value.match(/^([0-9a-f-]{36})--([0-9a-f-]{36})$/i)
  if (!match) return null
  return { projectId: match[1], id: match[2] }
}

export function composeDrawingId(projectId: string, id: string) {
  return `${projectId}--${id}`
}

function formatFromName(name: string, contentType?: string | null): DrawingFormat {
  if (name.toLowerCase().endsWith('.dwg') || /dwg|acad/i.test(contentType ?? '')) return 'dwg'
  return 'pdf'
}

function mapTableRow(row: {
  id: unknown
  project_id: unknown
  title?: unknown
  file_name?: unknown
  file_size?: unknown
  content_type?: unknown
  created_at?: unknown
  uploaded_by?: unknown
  discipline?: unknown
}): ProjectDrawing {
  const fileName = String(row.file_name ?? 'drawing.pdf')
  const title = String(row.title ?? fileName)
  const storedDiscipline = row.discipline as DrawingDiscipline | undefined
  return {
    id: composeDrawingId(String(row.project_id), String(row.id)),
    projectId: String(row.project_id),
    title,
    fileName,
    fileSize: row.file_size == null ? null : Number(row.file_size),
    format: formatFromName(fileName, row.content_type ? String(row.content_type) : null),
    discipline: inferDrawingDiscipline({
      title,
      fileName,
      discipline: storedDiscipline,
    }),
    createdAt: String(row.created_at ?? ''),
    uploadedBy: row.uploaded_by ? String(row.uploaded_by) : null,
  }
}

async function readDrawingMeta(
  storage: SupabaseClient,
  projectId: string,
  id: string
): Promise<DrawingMeta | null> {
  const { data, error } = await storage.storage.from(DRAWINGS_BUCKET).download(`${projectId}/${id}.json`)
  if (error || !data) return null
  try {
    return JSON.parse(await data.text()) as DrawingMeta
  } catch {
    return null
  }
}

async function resolveStoredPath(
  storage: SupabaseClient,
  projectId: string,
  id: string
): Promise<{ path: string; fileName: string; format: DrawingFormat }> {
  const { data: row } = await storage
    .from('project_drawings')
    .select('file_name, storage_path, content_type')
    .eq('id', id)
    .maybeSingle()

  if (row?.storage_path) {
    const fileName = String(row.file_name ?? 'drawing.pdf')
    return {
      path: String(row.storage_path),
      fileName,
      format: formatFromName(fileName, row.content_type ? String(row.content_type) : null),
    }
  }

  const meta = await readDrawingMeta(storage, projectId, id)
  const format = meta?.format ?? 'pdf'
  return {
    path: drawingPaths(projectId, id, format).file,
    fileName: meta?.fileName || `${id}.${format}`,
    format,
  }
}

export async function listProjectDrawings(projectId: string): Promise<ProjectDrawing[]> {
  const storage = getDrawingsStorage()
  await ensureDrawingsBucket(storage)

  const { data, error } = await storage
    .from('project_drawings')
    .select(
      'id, project_id, title, file_name, file_size, content_type, created_at, uploaded_by, discipline'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (!error) {
    const rows = (data ?? []).map(mapTableRow)
    const enriched: ProjectDrawing[] = []
    for (const row of rows) {
      const parsed = parseDrawingId(row.id)
      let discipline = row.discipline
      if (parsed) {
        const meta = await readDrawingMeta(storage, parsed.projectId, parsed.id)
        discipline = inferDrawingDiscipline({
          title: row.title,
          fileName: row.fileName,
          discipline: meta?.discipline ?? row.discipline,
        })
      }
      enriched.push({ ...row, discipline })
    }
    return enriched
  }
  if (!isMissingDrawingsTable(error)) throw new Error(error.message)

  const listed = await storage.storage.from(DRAWINGS_BUCKET).list(projectId, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (listed.error && !/not found|does not exist/i.test(listed.error.message)) {
    throw new Error(listed.error.message)
  }

  const files = (listed.data ?? []).filter((item) => /\.(pdf|dwg)$/i.test(item.name))
  const drawings: ProjectDrawing[] = []
  for (const file of files) {
    const format = formatFromName(file.name)
    const id = file.name.replace(/\.(pdf|dwg)$/i, '')
    const meta = await readDrawingMeta(storage, projectId, id)
    drawings.push({
      id: composeDrawingId(projectId, id),
      projectId,
      title: meta?.title || file.name.replace(/\.(pdf|dwg)$/i, ''),
      fileName: meta?.fileName || file.name,
      fileSize: meta?.fileSize ?? (file.metadata as { size?: number } | undefined)?.size ?? null,
      format: meta?.format ?? format,
      discipline: inferDrawingDiscipline({
        title: meta?.title || file.name,
        fileName: meta?.fileName || file.name,
        discipline: meta?.discipline,
      }),
      createdAt: meta?.createdAt || file.created_at || '',
      uploadedBy: meta?.uploadedBy ?? null,
    })
  }
  return drawings
}

/** Fetch one drawing by composite id (projectId--uuid), even if not in current project list. */
export async function getProjectDrawing(rawId: string): Promise<ProjectDrawing | null> {
  const parsed = parseDrawingId(rawId)
  if (!parsed) return null

  const storage = getDrawingsStorage()
  await ensureDrawingsBucket(storage)

  const { data, error } = await storage
    .from('project_drawings')
    .select(
      'id, project_id, title, file_name, file_size, content_type, created_at, uploaded_by, discipline'
    )
    .eq('id', parsed.id)
    .eq('project_id', parsed.projectId)
    .maybeSingle()

  if (!error && data) {
    const row = mapTableRow(data)
    const meta = await readDrawingMeta(storage, parsed.projectId, parsed.id)
    return {
      ...row,
      discipline: inferDrawingDiscipline({
        title: row.title,
        fileName: row.fileName,
        discipline: meta?.discipline ?? row.discipline,
      }),
    }
  }

  if (error && !isMissingDrawingsTable(error)) {
    throw new Error(error.message)
  }

  const meta = await readDrawingMeta(storage, parsed.projectId, parsed.id)
  const listed = await storage.storage.from(DRAWINGS_BUCKET).list(parsed.projectId, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  const file = (listed.data ?? []).find(
    (item) => item.name === `${parsed.id}.pdf` || item.name === `${parsed.id}.dwg`
  )
  if (!file && !meta) return null

  const format = meta?.format ?? (file?.name.toLowerCase().endsWith('.dwg') ? 'dwg' : 'pdf')
  const fileName = meta?.fileName || file?.name || `${parsed.id}.${format}`
  const title = meta?.title || fileName.replace(/\.(pdf|dwg)$/i, '')

  return {
    id: composeDrawingId(parsed.projectId, parsed.id),
    projectId: parsed.projectId,
    title,
    fileName,
    fileSize: meta?.fileSize ?? (file?.metadata as { size?: number } | undefined)?.size ?? null,
    format,
    discipline: inferDrawingDiscipline({
      title,
      fileName,
      discipline: meta?.discipline,
    }),
    createdAt: meta?.createdAt || file?.created_at || '',
    uploadedBy: meta?.uploadedBy ?? null,
  }
}

export async function saveDrawingToStorage(opts: {
  projectId: string
  title: string
  fileName: string
  file: File
  uploadedBy: string
  discipline?: DrawingDiscipline
}): Promise<ProjectDrawing> {
  const format = getDrawingFormat(opts.file)
  if (!format) throw new Error('فقط فایل PDF یا DWG پذیرفته می‌شود.')

  const storage = getDrawingsStorage()
  await ensureDrawingsBucket(storage)
  const id = crypto.randomUUID()
  const paths = drawingPaths(opts.projectId, id, format)
  const createdAt = new Date().toISOString()
  const discipline = inferDrawingDiscipline({
    title: opts.title,
    fileName: opts.fileName,
    discipline: opts.discipline,
  })
  const meta: DrawingMeta = {
    title: opts.title,
    fileName: opts.fileName,
    fileSize: opts.file.size,
    format,
    discipline,
    uploadedBy: opts.uploadedBy,
    createdAt,
  }

  const { error: uploadError } = await storage.storage.from(DRAWINGS_BUCKET).upload(paths.file, opts.file, {
    cacheControl: '3600',
    contentType: opts.file.type || drawingContentType(format),
    upsert: false,
  })
  if (uploadError) {
    throw new Error(
      /bucket not found/i.test(uploadError.message)
        ? 'فضای ذخیره‌سازی نقشه‌ها ساخته نشد. کلید سرویس سوپابیس را بررسی کنید.'
        : /mime type/i.test(uploadError.message)
          ? 'این نوع فایل در فضای ذخیره‌سازی مجاز نیست. صفحه را رفرش کنید و دوباره تلاش کنید.'
          : uploadError.message
    )
  }

  await storage.storage
    .from(DRAWINGS_BUCKET)
    .upload(paths.meta, Buffer.from(JSON.stringify(meta), 'utf8'), {
      contentType: 'application/json',
      upsert: true,
    })
    .catch(() => undefined)

  const { error: tableError } = await storage.from('project_drawings').insert({
    id,
    project_id: opts.projectId,
    title: opts.title,
    file_name: opts.fileName,
    storage_path: paths.file,
    file_size: opts.file.size,
    content_type: drawingContentType(format),
    uploaded_by: opts.uploadedBy,
    discipline,
  })
  if (tableError && !isMissingDrawingsTable(tableError)) {
    console.warn('project_drawings insert skipped:', tableError.message)
  }

  return {
    id: composeDrawingId(opts.projectId, id),
    projectId: opts.projectId,
    title: opts.title,
    fileName: opts.fileName,
    fileSize: opts.file.size,
    format,
    discipline,
    createdAt,
    uploadedBy: opts.uploadedBy,
  }
}

export async function getProjectDrawingStorage(rawId: string) {
  const parsed = parseDrawingId(rawId)
  if (!parsed) return null
  const storage = getDrawingsStorage()
  await ensureDrawingsBucket(storage)
  return resolveStoredPath(storage, parsed.projectId, parsed.id)
}

export async function signDrawingDownload(rawId: string): Promise<{ url: string; fileName: string }> {
  const parsed = parseDrawingId(rawId)
  if (!parsed) throw new Error('نقشه پیدا نشد.')
  const storage = getDrawingsStorage()
  await ensureDrawingsBucket(storage)
  const stored = await resolveStoredPath(storage, parsed.projectId, parsed.id)
  const { data, error } = await storage.storage.from(DRAWINGS_BUCKET).createSignedUrl(stored.path, 60 * 30)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'لینک دانلود ساخته نشد.')
  return { url: data.signedUrl, fileName: stored.fileName }
}

export async function deleteDrawing(rawId: string) {
  const parsed = parseDrawingId(rawId)
  if (!parsed) throw new Error('نقشه پیدا نشد.')
  const storage = getDrawingsStorage()
  const stored = await resolveStoredPath(storage, parsed.projectId, parsed.id).catch(() => null)
  const paths = [
    stored?.path,
    `${parsed.projectId}/${parsed.id}.pdf`,
    `${parsed.projectId}/${parsed.id}.dwg`,
    `${parsed.projectId}/${parsed.id}.json`,
  ].filter((path): path is string => Boolean(path))
  const { error } = await storage.storage.from(DRAWINGS_BUCKET).remove([...new Set(paths)])
  if (error) throw new Error(error.message)
  await storage.from('project_drawings').delete().eq('id', parsed.id)
}
