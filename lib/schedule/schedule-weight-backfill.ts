import type { SupabaseClient } from '@supabase/supabase-js'
import { parseMspXml } from '@/lib/schedule/msp-import'
import {
  SCHEDULE_BUCKET,
  getScheduleStorage,
  scheduleStoragePath,
} from '@/lib/schedule/schedule-files'

export interface ScheduleWeightBackfillResult {
  projectId: string
  importId: string | null
  source: 'storage' | 'none'
  tasksInXml: number
  tasksUpdated: number
  tasksWithWeight: number
}

type ScheduleImportRow = {
  id: string
  storage_path?: string | null
  storage_bucket?: string | null
}

async function fetchLatestCompletedImport(
  supabase: SupabaseClient,
  projectId: string
): Promise<ScheduleImportRow | null> {
  const withStorage = await supabase
    .from('schedule_imports')
    .select('id, storage_path, storage_bucket')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!withStorage.error) return (withStorage.data as ScheduleImportRow | null) ?? null

  if (!/storage_path|storage_bucket/i.test(withStorage.error.message ?? '')) {
    throw new Error(withStorage.error.message)
  }

  const basic = await supabase
    .from('schedule_imports')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (basic.error) throw new Error(basic.error.message)
  return (basic.data as ScheduleImportRow | null) ?? null
}

async function resolveStoredXmlPath(
  supabase: SupabaseClient,
  projectId: string,
  importRow: ScheduleImportRow
): Promise<string | null> {
  if (importRow.storage_path) return importRow.storage_path

  const conventional = scheduleStoragePath(projectId, importRow.id)
  const storage = getScheduleStorage()
  const bucket = importRow.storage_bucket ?? SCHEDULE_BUCKET
  const { data, error } = await storage.storage.from(bucket).download(conventional)
  if (!error && data) return conventional

  const { data: files } = await storage.storage.from(bucket).list(projectId, { limit: 50 })
  const xmlFile = (files ?? []).find((f) => f.name?.endsWith('.xml'))
  if (!xmlFile?.name) return null
  return `${projectId}/${xmlFile.name}`
}

/** Re-read weights from the latest stored MSP XML and update project_tasks.schedule_weight. */
export async function backfillScheduleWeightsFromStoredXml(
  supabase: SupabaseClient,
  projectId: string
): Promise<ScheduleWeightBackfillResult> {
  const importRow = await fetchLatestCompletedImport(supabase, projectId)

  if (!importRow) {
    return {
      projectId,
      importId: null,
      source: 'none',
      tasksInXml: 0,
      tasksUpdated: 0,
      tasksWithWeight: 0,
    }
  }

  const storagePath = await resolveStoredXmlPath(supabase, projectId, importRow)
  if (!storagePath) {
    return {
      projectId,
      importId: importRow.id,
      source: 'none',
      tasksInXml: 0,
      tasksUpdated: 0,
      tasksWithWeight: 0,
    }
  }

  const bucket = importRow.storage_bucket ?? SCHEDULE_BUCKET
  const storage = getScheduleStorage()
  const { data: file, error: downloadError } = await storage.storage
    .from(bucket)
    .download(storagePath)

  if (downloadError || !file) {
    throw new Error(downloadError?.message ?? 'Stored schedule XML could not be downloaded.')
  }

  const xml = await file.text()
  const parsed = parseMspXml(xml)

  const { data: existingTasks, error: tasksError } = await supabase
    .from('project_tasks')
    .select('id, msp_uid')
    .eq('project_id', projectId)

  if (tasksError) throw new Error(tasksError.message)

  const uidToId = new Map<number, string>()
  for (const row of existingTasks ?? []) {
    const uid = row.msp_uid as number | null
    if (uid != null) uidToId.set(uid, row.id as string)
  }

  let tasksUpdated = 0
  let tasksWithWeight = 0

  for (const task of parsed.tasks) {
    if (task.schedule_weight == null) continue
    tasksWithWeight++
    const taskId = uidToId.get(task.msp_uid)
    if (!taskId) continue

    const { error } = await supabase
      .from('project_tasks')
      .update({ schedule_weight: task.schedule_weight })
      .eq('id', taskId)

    if (error) {
      if (/schedule_weight/i.test(error.message)) {
        throw new Error(
          'ستون schedule_weight در دیتابیس وجود ندارد — migration 66 را در Supabase اجرا کنید.'
        )
      }
      throw new Error(error.message)
    }

    tasksUpdated++
  }

  return {
    projectId,
    importId: importRow.id,
    source: 'storage',
    tasksInXml: parsed.tasks.length,
    tasksWithWeight,
    tasksUpdated,
  }
}
