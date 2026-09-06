import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRelationType } from '@/types/schedule'
import { formatPredLabel } from '@/lib/schedule/predecessor-format'

/** successor_task_id → "1.1FS, 1.2SS+2d" */
export async function fetchTaskPredecessorLabels(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, string>> {
  const [{ data: deps, error: depErr }, { data: tasks, error: taskErr }] = await Promise.all([
    supabase
      .from('task_dependencies')
      .select('successor_task_id, predecessor_task_id, relation_type, lag_duration')
      .eq('project_id', projectId),
    supabase.from('project_tasks').select('id, wbs_code, msp_uid').eq('project_id', projectId),
  ])

  if (depErr && depErr.code !== '42P01') throw new Error(depErr.message)
  if (taskErr) throw new Error(taskErr.message)

  const idToWbs = new Map<string, string>()
  for (const t of tasks ?? []) {
    idToWbs.set(t.id, t.wbs_code ?? (t.msp_uid != null ? String(t.msp_uid) : '?'))
  }

  const bySuccessor = new Map<string, string[]>()
  for (const dep of deps ?? []) {
    const predWbs = idToWbs.get(dep.predecessor_task_id) ?? '?'
    const label = formatPredLabel(
      predWbs,
      dep.relation_type as TaskRelationType,
      dep.lag_duration ?? 0
    )
    const list = bySuccessor.get(dep.successor_task_id) ?? []
    list.push(label)
    bySuccessor.set(dep.successor_task_id, list)
  }

  const result: Record<string, string> = {}
  for (const [succId, labels] of bySuccessor) {
    result[succId] = labels.join(', ')
  }
  return result
}
