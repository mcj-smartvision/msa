import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleAlertSeverity } from '@/features/schedule/lib/float-alerts'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { formatScheduleDate, toIsoDateOnly } from '@/features/schedule/lib/dates'

export interface ActiveScheduleAlertDto {
  id: string
  activityId: string
  activityName: string | null
  severity: ScheduleAlertSeverity
  message: string
  totalFloat: number | null
  consumptionRate: number | null
  createdAt: string
}

export interface MilestoneTrendSeriesDto {
  taskId: string
  name: string
  baselineDate: string | null
  baselineLabel: string | null
  points: Array<{
    calculationDate: string
    calculationLabel: string
    predictedDate: string
    predictedLabel: string
    predictedTs: number
    baselineTs: number | null
  }>
}

export async function listActiveScheduleAlerts(
  supabase: SupabaseClient,
  projectId: string
): Promise<ActiveScheduleAlertDto[]> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const { data, error } = await supabase
    .from('schedule_alerts')
    .select('id, activity_id, severity, message, total_float, consumption_rate, created_at')
    .eq('project_id', projectId)
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new WorkshopError('VALIDATION', error.message)

  const activityIds = [...new Set((data ?? []).map((r) => r.activity_id as string))]
  const nameById = new Map<string, string>()
  if (activityIds.length > 0) {
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('id, name')
      .in('id', activityIds)
    for (const t of tasks ?? []) {
      nameById.set(t.id as string, String(t.name ?? ''))
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    activityId: row.activity_id as string,
    activityName: nameById.get(row.activity_id as string) ?? null,
    severity: row.severity as ScheduleAlertSeverity,
    message: String(row.message ?? ''),
    totalFloat: row.total_float != null ? Number(row.total_float) : null,
    consumptionRate: row.consumption_rate != null ? Number(row.consumption_rate) : null,
    createdAt: String(row.created_at),
  }))
}

export async function acknowledgeScheduleAlert(
  supabase: SupabaseClient,
  projectId: string,
  alertId: string
): Promise<void> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const { data, error } = await supabase
    .from('schedule_alerts')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('project_id', projectId)
    .eq('acknowledged', false)
    .select('id')
    .maybeSingle()

  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!data) throw new WorkshopError('NOT_FOUND', 'هشدار پیدا نشد یا قبلاً بسته شده')
}

function toDayTs(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00.000Z`).getTime()
}

export async function getMilestoneTrend(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ series: MilestoneTrendSeriesDto[] }> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const { data: milestones, error: mError } = await supabase
    .from('project_tasks')
    .select('id, name, milestone_baseline_date')
    .eq('project_id', projectId)
    .eq('is_milestone', true)
    .order('wbs_code', { ascending: true })

  if (mError) throw new WorkshopError('VALIDATION', mError.message)
  if (!milestones?.length) return { series: [] }

  const ids = milestones.map((m) => m.id as string)
  const { data: history, error: hError } = await supabase
    .from('milestone_forecast_history')
    .select('task_id, calculation_date, predicted_date')
    .eq('project_id', projectId)
    .in('task_id', ids)
    .order('calculation_date', { ascending: true })

  if (hError) throw new WorkshopError('VALIDATION', hError.message)

  const byTask = new Map<string, typeof history>()
  for (const row of history ?? []) {
    const id = row.task_id as string
    const list = byTask.get(id) ?? []
    list.push(row)
    byTask.set(id, list)
  }

  const series: MilestoneTrendSeriesDto[] = milestones.map((m) => {
    const baselineDate = toIsoDateOnly(m.milestone_baseline_date)
    const baselineTs = baselineDate ? toDayTs(baselineDate) : null
    const points = (byTask.get(m.id as string) ?? []).map((row) => {
      const calculationDate = String(row.calculation_date).slice(0, 10)
      const predictedDate = String(row.predicted_date).slice(0, 10)
      return {
        calculationDate,
        calculationLabel: formatScheduleDate(calculationDate, 'jalali'),
        predictedDate,
        predictedLabel: formatScheduleDate(predictedDate, 'jalali'),
        predictedTs: toDayTs(predictedDate),
        baselineTs,
      }
    })

    return {
      taskId: m.id as string,
      name: String(m.name ?? ''),
      baselineDate,
      baselineLabel: baselineDate ? formatScheduleDate(baselineDate, 'jalali') : null,
      points,
    }
  })

  return { series: series.filter((s) => s.points.length > 0 || s.baselineDate) }
}
