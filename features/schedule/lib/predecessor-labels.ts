import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskRelationType } from '@/shared/types/schedule'
import { explainDependencyLink } from '@/features/schedule/lib/dependency-explain'
import { formatPredLabel, DEFAULT_MSP_MINUTES_PER_DAY } from '@/features/schedule/lib/predecessor-format'

/** successor_task_id → "1.1FS, 1.2SS+2d" */
export async function fetchTaskPredecessorLabels(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, string>> {
  const { labels } = await fetchTaskPredecessorDisplay(supabase, projectId)
  return labels
}

/**
 * Labels for the پیش‌نیاز column + full Persian tooltips (one block per successor).
 */
export async function fetchTaskPredecessorDisplay(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ labels: Record<string, string>; tooltips: Record<string, string> }> {
  const [{ data: deps, error: depErr }, { data: tasks, error: taskErr }] = await Promise.all([
    supabase
      .from('task_dependencies')
      .select('successor_task_id, predecessor_task_id, relation_type, lag_duration')
      .eq('project_id', projectId),
    supabase
      .from('project_tasks')
      .select('id, name, wbs_code, msp_uid')
      .eq('project_id', projectId),
  ])

  if (depErr && depErr.code !== '42P01') throw new Error(depErr.message)
  if (taskErr) throw new Error(taskErr.message)

  const idToMeta = new Map<string, { wbs: string; name: string }>()
  for (const t of tasks ?? []) {
    idToMeta.set(t.id as string, {
      wbs: (t.wbs_code as string | null)?.trim() || (t.msp_uid != null ? String(t.msp_uid) : '?'),
      name: String(t.name ?? ''),
    })
  }

  const dayLen = DEFAULT_MSP_MINUTES_PER_DAY
  const bySuccessorLabels = new Map<string, string[]>()
  const bySuccessorTips = new Map<string, string[]>()

  for (const dep of deps ?? []) {
    const succId = dep.successor_task_id as string
    const predId = dep.predecessor_task_id as string
    const pred = idToMeta.get(predId)
    const succ = idToMeta.get(succId)
    const type = (dep.relation_type as TaskRelationType) || 'FS'
    const lagMin = Number(dep.lag_duration) || 0
    const lagDays = lagMin && dayLen > 0 ? Math.round(lagMin / dayLen) : 0
    const predWbs = pred?.wbs ?? '?'
    const label = formatPredLabel(predWbs, type, lagMin)
    const explained = explainDependencyLink({
      type,
      lagDays,
      predecessor: { id: predId, wbs: pred?.wbs, name: pred?.name },
      successor: { id: succId, wbs: succ?.wbs, name: succ?.name },
    })

    const labels = bySuccessorLabels.get(succId) ?? []
    labels.push(label)
    bySuccessorLabels.set(succId, labels)

    const tips = bySuccessorTips.get(succId) ?? []
    tips.push(explained.tooltip)
    bySuccessorTips.set(succId, tips)
  }

  const labels: Record<string, string> = {}
  const tooltips: Record<string, string> = {}
  for (const [succId, list] of bySuccessorLabels) {
    labels[succId] = list.join(', ')
  }
  for (const [succId, list] of bySuccessorTips) {
    tooltips[succId] =
      list.length === 1
        ? list[0]!
        : list.map((t, i) => `پیوند ${i + 1} از ${list.length}\n${t}`).join('\n\n')
  }
  return { labels, tooltips }
}
