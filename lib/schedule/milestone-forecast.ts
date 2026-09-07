import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysIso, toIsoDateOnly } from '@/lib/schedule/dates'
import type { CpmActivityResult } from '@/lib/schedule/cpm-calculate'

/**
 * Calendar epoch for CPM day-0: project actual/baseline start, else earliest task start.
 */
export async function resolveCpmCalendarEpoch(
  supabase: SupabaseClient,
  projectId: string,
  taskStarts: Array<string | null | undefined>
): Promise<string | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('schedule_actual_start, schedule_baseline_start')
    .eq('id', projectId)
    .maybeSingle()

  const fromProject =
    toIsoDateOnly(project?.schedule_actual_start) ??
    toIsoDateOnly(project?.schedule_baseline_start)
  if (fromProject) return fromProject

  let min: string | null = null
  for (const s of taskStarts) {
    const iso = toIsoDateOnly(s)
    if (!iso) continue
    if (!min || iso < min) min = iso
  }
  return min
}

/**
 * Persist milestone baseline (once) + forecast history after each CPM run.
 */
export async function persistMilestoneForecasts(
  supabase: SupabaseClient,
  input: {
    projectId: string
    calculationDate: string
    calculatedAt: string
    cpmEpoch: string
    activities: CpmActivityResult[]
    milestoneTaskIds: Set<string>
  }
): Promise<{ baselinesSet: number; forecastsInserted: number }> {
  const milestoneResults = input.activities.filter((a) => input.milestoneTaskIds.has(a.id))
  if (milestoneResults.length === 0) {
    return { baselinesSet: 0, forecastsInserted: 0 }
  }

  const ids = milestoneResults.map((a) => a.id)
  const { data: existing, error: readError } = await supabase
    .from('project_tasks')
    .select('id, milestone_baseline_date')
    .eq('project_id', input.projectId)
    .in('id', ids)

  if (readError) {
    throw new Error(`خواندن مایلستون‌ها ناموفق: ${readError.message}`)
  }

  const baselineById = new Map(
    (existing ?? []).map((r) => [r.id as string, toIsoDateOnly(r.milestone_baseline_date)])
  )

  let baselinesSet = 0
  const forecastRows: Array<{
    project_id: string
    task_id: string
    calculation_date: string
    predicted_date: string
    early_finish_days: number
    calculated_at: string
  }> = []

  for (const activity of milestoneResults) {
    const predicted = addDaysIso(input.cpmEpoch, Math.round(activity.earlyFinish))
    forecastRows.push({
      project_id: input.projectId,
      task_id: activity.id,
      calculation_date: input.calculationDate,
      predicted_date: predicted,
      early_finish_days: activity.earlyFinish,
      calculated_at: input.calculatedAt,
    })

    const existingBaseline = baselineById.get(activity.id)
    if (!existingBaseline) {
      const { error: updError } = await supabase
        .from('project_tasks')
        .update({ milestone_baseline_date: predicted })
        .eq('id', activity.id)
        .eq('project_id', input.projectId)
        .is('milestone_baseline_date', null)
      if (updError) {
        throw new Error(`ذخیره milestone_baseline_date ناموفق: ${updError.message}`)
      }
      baselinesSet++
    }
  }

  const { error: histError } = await supabase.from('milestone_forecast_history').insert(forecastRows)
  if (histError) {
    throw new Error(`ذخیره milestone_forecast_history ناموفق: ${histError.message}`)
  }

  return { baselinesSet, forecastsInserted: forecastRows.length }
}
