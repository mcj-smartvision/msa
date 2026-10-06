import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { exportMspXmlFromProject } from '@/features/schedule/lib/msp-export'
import {
SCHEDULE_BUCKET,
scheduleStoragePath,
signScheduleFileDownload,
} from '@/features/schedule/lib/schedule-files'

export function ensureXmlFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (!trimmed) return 'schedule.xml'
  return trimmed.toLowerCase().endsWith('.xml') ? trimmed : `${trimmed}.xml`
}

type ImportRow = {
  id: string
  project_id: string
  file_name: string
  status: string
}

export async function fetchScheduleImportRow(
  supabase: SupabaseClient,
  importId: string
): Promise<ImportRow | null> {
  const { data, error } = await supabase
    .from('schedule_imports')
    .select('id, project_id, file_name, status')
    .eq('id', importId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return data as ImportRow | null
}

export async function fetchLatestCompletedImport(
  supabase: SupabaseClient,
  projectId: string
): Promise<ImportRow | null> {
  const { data, error } = await supabase
    .from('schedule_imports')
    .select('id, project_id, file_name, status')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  return data as ImportRow | null
}

async function tryStoredXmlBytes(
  projectId: string,
  importId: string,
  fileName: string,
  storagePath?: string | null
): Promise<{ bytes: ArrayBuffer; fileName: string } | null> {
  const paths = [
    storagePath,
    scheduleStoragePath(projectId, importId),
  ].filter((p): p is string => Boolean(p))

  const storage = createServiceClient()

  for (const path of paths) {
    const { data, error } = await storage.storage.from(SCHEDULE_BUCKET).download(path)
    if (!error && data) {
      const bytes = await data.arrayBuffer()
      if (bytes.byteLength > 0) {
        return { bytes, fileName: ensureXmlFileName(fileName) }
      }
    }
  }

  try {
    const signed = await signScheduleFileDownload(projectId, paths[0]!, ensureXmlFileName(fileName))
    const file = await fetch(signed.url)
    if (file.ok) {
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > 0) {
        return { bytes, fileName: ensureXmlFileName(signed.fileName) }
      }
    }
  } catch {
    /* fall through to DB export */
  }

  return null
}

export async function buildScheduleXmlDownload(
  projectId: string,
  importRow?: ImportRow | null,
  options?: { originalOnly?: boolean }
): Promise<{ body: ArrayBuffer | string; fileName: string }> {
  const storage = createServiceClient()
  const originalOnly = options?.originalOnly ?? false

  if (importRow?.status === 'completed') {
    let storagePath: string | null = null
    const { data: withPath } = await storage
      .from('schedule_imports')
      .select('storage_path')
      .eq('id', importRow.id)
      .maybeSingle()

    if (withPath && 'storage_path' in withPath) {
      storagePath = (withPath as { storage_path?: string | null }).storage_path ?? null
    }

    const stored = await tryStoredXmlBytes(
      projectId,
      importRow.id,
      importRow.file_name,
      storagePath
    )
    if (stored) {
      return { body: stored.bytes, fileName: stored.fileName }
    }
  }

  if (originalOnly) {
    throw new Error(
      'فایل XML اولیه در سرور موجود نیست. برنامه را دوباره از Microsoft Project (Save As → XML) وارد کنید.'
    )
  }

  const { xml, fileName } = await exportMspXmlFromProject(storage, projectId)
  return { body: xml, fileName: ensureXmlFileName(fileName) }
}

export function scheduleDownloadHeaders(fileName: string) {
  const safeName = ensureXmlFileName(fileName)
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
    'X-File-Name': encodeURIComponent(safeName),
    'Cache-Control': 'private, max-age=120',
  }
}
