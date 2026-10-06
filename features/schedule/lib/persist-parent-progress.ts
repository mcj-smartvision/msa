import type { SupabaseClient } from '@supabase/supabase-js'
import { applyWeightedParentRollup } from '@/features/schedule/lib/parent-progress-rollup'
import { applyParentWeightSum } from '@/features/schedule/lib/parent-weight-rollup'
import { schedulePhysicalPercent } from '@/features/schedule/lib/physical-progress'

type TaskRow = {
  id: string
  wbs_code: string | null
  name: string | null
  schedule_weight: number | null
  percent_complete: number | null
  physical_percent_complete: number | null
}

/**
 * Re-derives the stored percent of every heading (WBS parent) task from its children:
 * parent % = Σ(childWeight × child%) / Σ(childWeight), bottom-up, with parent weights being the
 * sum of their children — the same rule the schedule editor shows. Only headings whose stored
 * value differs are written. Returns how many headings were updated.
 */
export async function persistParentProgressRollup(
  supabase: SupabaseClient,
  projectId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('id, wbs_code, name, schedule_weight, percent_complete, physical_percent_complete')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  const tasks = (data ?? []) as TaskRow[]
  if (tasks.length === 0) return 0

  const weightRollup = applyParentWeightSum(
    tasks.map((t) => ({ id: t.id, wbs: t.wbs_code, name: t.name ?? '', weight: t.schedule_weight }))
  )
  const progressRollup = applyWeightedParentRollup(
    tasks.map((t) => ({
      id: t.id,
      wbs: t.wbs_code,
      name: t.name ?? '',
      weight: weightRollup.weights[t.id] ?? null,
      percent: schedulePhysicalPercent(t) ?? 0,
    }))
  )

  const now = new Date().toISOString()
  let updated = 0
  for (const task of tasks) {
    if (!progressRollup.parentIds.has(task.id)) continue
    const pct = progressRollup.percents[task.id]
    if (pct == null) continue
    if (Number(task.percent_complete) === pct && Number(task.physical_percent_complete) === pct) continue
    const { error: updateError } = await supabase
      .from('project_tasks')
      .update({ percent_complete: pct, physical_percent_complete: pct, updated_at: now })
      .eq('id', task.id)
      .eq('project_id', projectId)
    if (updateError) throw new Error(updateError.message)
    updated++
  }
  return updated
}
