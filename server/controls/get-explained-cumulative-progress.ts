import type { SupabaseClient } from '@supabase/supabase-js'
import { loadProjectEvm } from '@/lib/evm/load-project-evm'
import {
  buildExplainedCumulativeProgress,
  type ExplainedCumulativeProgress,
} from '@/lib/project-controls/cumulative-progress'
import { createServiceClient } from '@/lib/supabase/service'
import { todayTehranIso } from '@/lib/time/tehran'

type Row = Record<string, unknown>

/** Latest percent per activity from the progress history, dated on or before `asOf`. */
async function progressAsOf(service: SupabaseClient, projectId: string, asOf: string) {
  const [tasks, packages] = await Promise.all([
    service
      .from('task_progress_updates')
      .select('task_id, percent_complete, progress_date, created_at')
      .eq('project_id', projectId)
      .lte('progress_date', asOf)
      .order('progress_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20000),
    service
      .from('package_progress_updates')
      .select('package_id, percent_complete, progress_date, created_at')
      .eq('project_id', projectId)
      .lte('progress_date', asOf)
      .order('progress_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20000),
  ])
  if (tasks.error) throw new Error(`خواندن تاریخچهٔ پیشرفت فعالیت‌ها ناموفق: ${tasks.error.message}`)
  if (packages.error) throw new Error(`خواندن تاریخچهٔ پیشرفت بسته‌ها ناموفق: ${packages.error.message}`)
  const latest = new Map<string, { percent: number; source: 'record' }>()
  const put = (id: unknown, percent: unknown) => {
    const p = Number(percent)
    if (id != null && Number.isFinite(p)) latest.set(String(id), { percent: p, source: 'record' })
  }
  for (const row of (tasks.data ?? []) as Row[]) put(row.task_id, row.percent_complete)
  for (const row of (packages.data ?? []) as Row[]) put(row.package_id, row.percent_complete)
  return latest
}

/**
 * Explainable Planned / Actual cumulative progress with a row-by-row WBS breakdown. On today it
 * reads the current approved physical percent (the dashboard card); for a past date it reads the
 * latest progress record of each activity on or before that date. Uses a service-role client, so
 * the caller must authorize project access.
 */
export async function getExplainedCumulativeProgress(
  projectId: string,
  asOfDate?: string,
  options: { service?: SupabaseClient; now?: Date } = {}
): Promise<ExplainedCumulativeProgress> {
  const service = options.service ?? createServiceClient()
  const today = todayTehranIso((options.now ?? new Date()).getTime())
  const asOf = asOfDate ?? today
  if (asOf > today) throw new Error('تاریخ محاسبه نمی‌تواند بعد از امروز باشد؛ پیشرفت واقعی آینده ثبت نشده است.')
  const [evm, history] = await Promise.all([
    loadProjectEvm(service, projectId, { asOf, today }),
    asOf < today ? progressAsOf(service, projectId, asOf) : Promise.resolve(undefined),
  ])
  return buildExplainedCumulativeProgress(evm, history)
}
