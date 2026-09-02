import type { SupabaseClient } from '@supabase/supabase-js'
import type { MspImportResult, ProjectTask, ScheduleImport } from '@/types/schedule'
import { parseMspXml } from '@/lib/schedule/msp-parser'
import { computeBaselineStartFromTasks } from '@/lib/schedule/dates'
import { setScheduleBaselineAfterImport } from '@/lib/schedule/apply-actual-start'
import { compareWbs } from '@/lib/schedule/wbs-utils'
import { storeScheduleXml } from '@/lib/schedule/schedule-files'
import { wipeProjectScheduleBeforeImport } from '@/lib/schedule/wipe-project-schedule'

export interface MspParsedTask {
  msp_uid: number
  wbs_code: string | null
  name: string
  start_planned: string | null
  finish_planned: string | null
  percent_complete: number
  is_critical: boolean
  is_summary: boolean
  /** Activity weight from MSP custom field (وزن) */
  schedule_weight: number | null
}

export interface MspParsedDependency {
  predecessor_uid: number
  successor_uid: number
  relation_type: 'FS' | 'SS' | 'FF' | 'SF'
  lag_duration: number
}

export { parseMspXml }

/** Persist parsed MSP data into Supabase (idempotent by project_id + msp_uid). */
export async function importMspScheduleToProject(
  supabase: SupabaseClient,
  projectId: string,
  fileName: string,
  xmlContent: string,
  importedBy: string
): Promise<MspImportResult> {
  const parsed = parseMspXml(xmlContent)

  const { data: importRow, error: importError } = await supabase
    .from('schedule_imports')
    .insert({
      project_id: projectId,
      file_name: fileName,
      status: 'processing',
      imported_by: importedBy,
    })
    .select()
    .single()

  if (importError) throw new Error(importError.message)

  let storagePath: string | null = null
  try {
    storagePath = await storeScheduleXml(projectId, importRow.id, xmlContent)
    await supabase
      .from('schedule_imports')
      .update({ storage_path: storagePath, storage_bucket: 'project-schedules' })
      .eq('id', importRow.id)
  } catch {
    /* import still proceeds if storage bucket is unavailable */
  }

  try {
    await wipeProjectScheduleBeforeImport(supabase, projectId)

    const { error: weightColumnProbe } = await supabase
      .from('project_tasks')
      .select('schedule_weight')
      .limit(0)

    const scheduleWeightSupported =
      !weightColumnProbe ||
      !/schedule_weight/i.test(weightColumnProbe.message ?? '')

    const { error: summaryColumnProbe } = await supabase
      .from('project_tasks')
      .select('is_summary')
      .limit(0)

    const summaryColumnSupported =
      !summaryColumnProbe ||
      !/is_summary/i.test(summaryColumnProbe.message ?? '')

    const uidToTaskId = new Map<number, string>()
    let tasksImported = 0

    for (const task of parsed.tasks) {
      const row: Record<string, unknown> = {
        project_id: projectId,
        msp_uid: task.msp_uid,
        wbs_code: task.wbs_code,
        name: task.name,
        start_planned: task.start_planned,
        finish_planned: task.finish_planned,
        baseline_start: task.start_planned,
        baseline_finish: task.finish_planned,
        start_current: task.start_planned,
        finish_current: task.finish_planned,
        percent_complete: task.percent_complete,
        is_critical: task.is_critical,
      }

      if (scheduleWeightSupported) {
        row.schedule_weight = task.schedule_weight
      }

      if (summaryColumnSupported) {
        row.is_summary = task.is_summary
      }

      const { data, error } = await supabase
        .from('project_tasks')
        .upsert(row, { onConflict: 'project_id,msp_uid' })
        .select('id, msp_uid')
        .single()

      if (error) throw new Error(error.message)
      if (data?.msp_uid != null) uidToTaskId.set(data.msp_uid, data.id)
      tasksImported++
    }

    let dependenciesImported = 0
    for (const dep of parsed.dependencies) {
      const predecessorId = uidToTaskId.get(dep.predecessor_uid)
      const successorId = uidToTaskId.get(dep.successor_uid)
      if (!predecessorId || !successorId) continue

      const { error } = await supabase.from('task_dependencies').upsert(
        {
          project_id: projectId,
          predecessor_task_id: predecessorId,
          successor_task_id: successorId,
          relation_type: dep.relation_type,
          lag_duration: dep.lag_duration,
        },
        { onConflict: 'project_id,predecessor_task_id,successor_task_id,relation_type' }
      )

      if (error) throw new Error(error.message)
      dependenciesImported++
    }

    await supabase
      .from('schedule_imports')
      .update({
        status: 'completed',
        tasks_imported: tasksImported,
        dependencies_imported: dependenciesImported,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)

    const baseline_start =
      computeBaselineStartFromTasks(
        parsed.tasks.map((t) => ({
          baseline_start: t.start_planned,
          start_planned: t.start_planned,
        }))
      ) ?? new Date().toISOString().slice(0, 10)

    await setScheduleBaselineAfterImport(supabase, projectId, baseline_start)

    return {
      import_id: importRow.id,
      tasks_imported: tasksImported,
      dependencies_imported: dependenciesImported,
      baseline_start,
      needs_start_confirmation: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed'
    await supabase
      .from('schedule_imports')
      .update({
        status: 'failed',
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)
    throw error
  }
}

export async function fetchScheduleImports(
  supabase: SupabaseClient,
  projectId: string,
  limit = 10
): Promise<ScheduleImport[]> {
  const { data, error } = await supabase
    .from('schedule_imports')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as ScheduleImport[]
}

export async function fetchProjectTasksSummary(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ count: number; tasks: ProjectTask[] }> {
  const { data, error, count } = await supabase
    .from('project_tasks')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .limit(500)

  if (error) {
    if (error.code === '42P01') return { count: 0, tasks: [] }
    throw new Error(error.message)
  }

  const tasks = ((data ?? []) as ProjectTask[]).sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))

  return { count: count ?? 0, tasks }
}
