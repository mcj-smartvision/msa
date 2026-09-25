import type { SupabaseClient } from '@supabase/supabase-js'
import { enumerateProjectJalaliMonths } from '@/lib/schedule/monthly-deducted-weight'
import { accumulateMonthlyProjectProgress } from '@/lib/schedule/monthly-project-progress'
import { todayIso } from '@/lib/schedule/progress-snapshots'
import { toIsoDateOnly } from '@/lib/schedule/dates'

type WeightRow = {
  activity_id: string
  snapshot_month: string
  planned_weight?: number | null
  earned_weight?: number | null
}

async function leafIds(supabase: SupabaseClient, projectId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('id, is_summary')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  return new Set(
    ((data ?? []) as Array<{ id: string; is_summary: boolean | null }> )
      .filter((task) => !task.is_summary)
      .map((task) => task.id)
  )
}

async function projectStartIso(supabase: SupabaseClient, projectId: string): Promise<string | null> {
  const [{ data: project }, { data: tasks }] = await Promise.all([
    supabase.from('projects').select('start_date').eq('id', projectId).maybeSingle(),
    supabase
      .from('project_tasks')
      .select('baseline_start, start_planned')
      .eq('project_id', projectId),
  ])
  const dates: string[] = []
  const projectStart = toIsoDateOnly((project as { start_date?: string | null } | null)?.start_date)
  if (projectStart) dates.push(projectStart)
  for (const task of tasks ?? []) {
    const row = task as { baseline_start?: string | null; start_planned?: string | null }
    const baseline = toIsoDateOnly(row.baseline_start)
    const planned = toIsoDateOnly(row.start_planned)
    if (baseline) dates.push(baseline)
    if (planned) dates.push(planned)
  }
  if (dates.length === 0) return null
  return dates.sort()[0] ?? null
}

function sumByMonth(rows: WeightRow[], leaves: Set<string>, field: 'planned_weight' | 'earned_weight') {
  const totals = new Map<string, number>()
  const seen = new Set<string>()
  for (const row of rows) {
    if (!leaves.has(row.activity_id)) continue
    const month = String(row.snapshot_month).slice(0, 10)
    seen.add(month)
    const value = Number(row[field]) || 0
    totals.set(month, (totals.get(month) ?? 0) + value)
  }
  return { totals, seen }
}

/**
 * One row per Jalali month from project start through today.
 * Sums leaf activities only so summary rows are not counted twice.
 */
export async function persistMonthlyProjectProgress(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ months: number }> {
  const leaves = await leafIds(supabase, projectId)
  const [plannedRes, earnedRes, start] = await Promise.all([
    supabase
      .from('activity_planned_weights')
      .select('activity_id, snapshot_month, planned_weight')
      .eq('project_id', projectId),
    supabase
      .from('activity_earned_weights')
      .select('activity_id, snapshot_month, earned_weight')
      .eq('project_id', projectId),
    projectStartIso(supabase, projectId),
  ])
  if (plannedRes.error) throw new Error(plannedRes.error.message)
  if (earnedRes.error) throw new Error(earnedRes.error.message)

  const planned = sumByMonth((plannedRes.data ?? []) as WeightRow[], leaves, 'planned_weight')
  const earned = sumByMonth((earnedRes.data ?? []) as WeightRow[], leaves, 'earned_weight')
  const today = todayIso()
  const rangeStart = start && start < today ? start : today
  const calendar = enumerateProjectJalaliMonths(rangeStart, today)

  const rows = accumulateMonthlyProjectProgress(
    calendar.map((month) => ({
      month: month.startIso,
      plannedWeight: planned.totals.get(month.startIso) ?? 0,
      earnedWeight: earned.seen.has(month.startIso) ? earned.totals.get(month.startIso) ?? 0 : null,
    }))
  )

  const { error: deleteError } = await supabase
    .from('monthly_project_progress')
    .delete()
    .eq('project_id', projectId)
  if (deleteError) throw new Error(deleteError.message)
  if (rows.length === 0) return { months: 0 }

  const { error: insertError } = await supabase.from('monthly_project_progress').insert(
    rows.map((row) => ({
      project_id: projectId,
      month: row.month,
      planned_weight: row.plannedWeight,
      earned_weight: row.earnedWeight,
      planned_cumulative: row.plannedCumulative,
      earned_cumulative: row.earnedCumulative,
    }))
  )
  if (insertError) throw new Error(insertError.message)

  try {
    const { persistMonthProgressOverhead } = await import('@/lib/schedule/persist-month-overhead')
    await persistMonthProgressOverhead(supabase, projectId)
  } catch {
    /* overhead allocation optional until migration 97 */
  }

  return { months: rows.length }
}
