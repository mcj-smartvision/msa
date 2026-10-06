import type { SupabaseClient } from '@supabase/supabase-js'

export type CarriedSupervisorProgress = {
  mspUid: number | null
  wbs: string
  percent: number
  reportDate: string
}

/**
 * Latest supervisor percent per activity, keyed so a replaced schedule
 * can receive it again by MSP uid or WBS. Call this before the import wipe.
 */
export async function carrySupervisorProgress(
  supabase: SupabaseClient,
  projectId: string
): Promise<CarriedSupervisorProgress[]> {
  const [{ data: tasks, error: taskError }, { data: updates, error: updateError }] =
    await Promise.all([
      supabase.from('project_tasks').select('id, msp_uid, wbs_code').eq('project_id', projectId),
      supabase
        .from('task_progress_updates')
        .select('task_id, progress_date, percent_complete')
        .eq('project_id', projectId)
        .order('progress_date', { ascending: true }),
    ])
  if (taskError && taskError.code !== '42P01') throw new Error(taskError.message)
  if (updateError) {
    if (updateError.code === '42P01' || /task_progress_updates/i.test(updateError.message)) return []
    throw new Error(updateError.message)
  }

  const latest = new Map<string, { percent: number; reportDate: string }>()
  for (const row of updates ?? []) {
    const taskId = String(row.task_id ?? '')
    const reportDate = String(row.progress_date ?? '').slice(0, 10)
    if (!taskId || !reportDate) continue
    latest.set(taskId, {
      percent: Math.min(100, Math.max(0, Number(row.percent_complete) || 0)),
      reportDate,
    })
  }

  const carried: CarriedSupervisorProgress[] = []
  for (const task of tasks ?? []) {
    const hit = latest.get(String(task.id))
    if (!hit) continue
    carried.push({
      mspUid: task.msp_uid == null ? null : Number(task.msp_uid),
      wbs: String(task.wbs_code ?? '').trim(),
      percent: hit.percent,
      reportDate: hit.reportDate,
    })
  }
  return carried
}

/** Write carried supervisor percents onto the new schedule rows. */
export async function reapplyCarriedSupervisorProgress(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null,
  carried: CarriedSupervisorProgress[],
  tasks: Array<{ id: string; mspUid: number | null; wbs: string }>
): Promise<number> {
  if (!carried.length || !tasks.length) return 0
  const byUid = new Map<number, CarriedSupervisorProgress>()
  const byWbs = new Map<string, CarriedSupervisorProgress>()
  for (const item of carried) {
    if (item.mspUid != null && Number.isFinite(item.mspUid)) byUid.set(item.mspUid, item)
    if (item.wbs) byWbs.set(item.wbs, item)
  }

  let applied = 0
  const now = new Date().toISOString()
  for (const task of tasks) {
    const hit =
      (task.mspUid != null ? byUid.get(task.mspUid) : undefined) ??
      (task.wbs ? byWbs.get(task.wbs) : undefined)
    if (!hit) continue
    const { error } = await supabase
      .from('project_tasks')
      .update({
        percent_complete: hit.percent,
        physical_percent_complete: hit.percent,
        updated_at: now,
      })
      .eq('id', task.id)
      .eq('project_id', projectId)
    if (error) throw new Error(error.message)
    await supabase.from('task_progress_updates').insert({
      project_id: projectId,
      task_id: task.id,
      progress_date: hit.reportDate,
      percent_complete: hit.percent,
      ...(userId ? { created_by: userId } : {}),
    })
    applied += 1
  }
  return applied
}
