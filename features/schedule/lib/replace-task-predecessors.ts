import type { SupabaseClient } from '@supabase/supabase-js';
import {
DEFAULT_MSP_MINUTES_PER_DAY,
parsePredecessorLinks,
} from '@/features/schedule/lib/predecessor-format';
import { WorkshopError } from '@/features/workshop/lib/domain';

/**
 * Replace all predecessors of a project_tasks row from editable label text
 * like "3FS+4d, 4.1FS".
 */
export async function replaceTaskPredecessorsFromLabel(
  supabase: SupabaseClient,
  projectId: string,
  successorTaskId: string,
  label: string
): Promise<{ count: number; label: string }> {
  const links = parsePredecessorLinks(label)

  const { data: tasks, error: taskErr } = await supabase
    .from('project_tasks')
    .select('id, wbs_code')
    .eq('project_id', projectId)
  if (taskErr) throw new WorkshopError('VALIDATION', taskErr.message)

  const wbsToId = new Map<string, string>()
  for (const t of tasks ?? []) {
    const wbs = String(t.wbs_code ?? '').trim()
    if (wbs) wbsToId.set(wbs, t.id as string)
  }

  const rows: Array<{
    project_id: string
    predecessor_task_id: string
    successor_task_id: string
    relation_type: string
    lag_duration: number
  }> = []

  for (const link of links) {
    const predId = wbsToId.get(link.wbs)
    if (!predId) {
      throw new WorkshopError(
        'VALIDATION',
        `پیش‌نیاز «${link.wbs}» در برنامه پیدا نشد — کد WBS را درست وارد کنید`
      )
    }
    if (predId === successorTaskId) {
      throw new WorkshopError('VALIDATION', 'فعالیت نمی‌تواند پیش‌نیاز خودش باشد')
    }
    rows.push({
      project_id: projectId,
      predecessor_task_id: predId,
      successor_task_id: successorTaskId,
      relation_type: link.relation,
      lag_duration: Math.round(link.lagDays * DEFAULT_MSP_MINUTES_PER_DAY),
    })
  }

  const { error: delErr } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('project_id', projectId)
    .eq('successor_task_id', successorTaskId)
  if (delErr) throw new WorkshopError('VALIDATION', delErr.message)

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('task_dependencies').insert(rows)
    if (insErr) throw new WorkshopError('VALIDATION', insErr.message)
  }

  const normalized = rows
    .map((r) => {
      const wbs =
        [...wbsToId.entries()].find(([, id]) => id === r.predecessor_task_id)?.[0] ?? '?'
      const lagDays =
        r.lag_duration !== 0
          ? Math.round(r.lag_duration / DEFAULT_MSP_MINUTES_PER_DAY)
          : 0
      const lag =
        lagDays === 0 ? '' : lagDays > 0 ? `+${lagDays}d` : `${lagDays}d`
      return `${wbs}${r.relation_type}${lag}`
    })
    .join(', ')

  return { count: rows.length, label: normalized }
}
