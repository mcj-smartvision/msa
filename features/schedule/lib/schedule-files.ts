import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/shared/lib/supabase/service'

export const SCHEDULE_BUCKET = 'project-schedules'
export const SCHEDULE_MAX_BYTES = 50 * 1024 * 1024

const SCHEDULE_ALLOWED_MIMES = ['text/xml', 'application/xml', 'application/octet-stream']

export function getScheduleStorage(): SupabaseClient {
  return createServiceClient()
}

export async function ensureScheduleBucket(storage: SupabaseClient) {
  const { data } = await storage.storage.listBuckets()
  const exists = (data ?? []).some((b) => b.id === SCHEDULE_BUCKET)
  if (!exists) {
    const { error } = await storage.storage.createBucket(SCHEDULE_BUCKET, {
      public: false,
      fileSizeLimit: SCHEDULE_MAX_BYTES,
      allowedMimeTypes: SCHEDULE_ALLOWED_MIMES,
    })
    if (error && !error.message.toLowerCase().includes('already')) {
      throw new Error(error.message)
    }
  }

  await storage.storage.updateBucket(SCHEDULE_BUCKET, {
    public: false,
    fileSizeLimit: SCHEDULE_MAX_BYTES,
    allowedMimeTypes: SCHEDULE_ALLOWED_MIMES,
  })
}

export function scheduleStoragePath(projectId: string, importId: string): string {
  return `${projectId}/${importId}.xml`
}

export async function storeScheduleXml(
  projectId: string,
  importId: string,
  xmlContent: string
): Promise<string> {
  const storage = getScheduleStorage()
  await ensureScheduleBucket(storage)
  const path = scheduleStoragePath(projectId, importId)

  const { error } = await storage.storage.from(SCHEDULE_BUCKET).upload(path, xmlContent, {
    contentType: 'application/xml',
    upsert: true,
  })

  if (error) throw new Error(error.message)
  return path
}

export async function signScheduleFileDownload(
  projectId: string,
  storagePath: string,
  fileName: string
): Promise<{ url: string; fileName: string }> {
  const storage = getScheduleStorage()
  await ensureScheduleBucket(storage)

  const { data, error } = await storage.storage
    .from(SCHEDULE_BUCKET)
    .createSignedUrl(storagePath, 60 * 30)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'امضای دانلود برنامه انجام نشد.')
  }

  return { url: data.signedUrl, fileName }
}
