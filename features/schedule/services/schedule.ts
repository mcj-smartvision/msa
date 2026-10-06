import type { SupabaseClient } from '@supabase/supabase-js'
import type {
CreateDailyReportInput,
ProjectAlert,
ProjectScheduleSummary,
ProjectTask,
SiteDailyReport,
} from '@/shared/types/schedule'
import { normalizeScheduleWeightPercent, weightedProgressPercent } from '@/features/schedule/lib/weighted-progress'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekEndIsoDate(from = new Date()): string {
  const end = new Date(from)
  end.setDate(end.getDate() + 7)
  return end.toISOString().slice(0, 10)
}

export async function fetchProjectTasksForWeek(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('start_current', { ascending: true, nullsFirst: false })

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  const tasks = (data ?? []) as ProjectTask[]
  const start = todayIsoDate()
  const end = weekEndIsoDate()

  return tasks.filter((task) => {
    const startIso = (task.start_current ?? task.start_planned)?.slice(0, 10)
    const finishIso = (task.finish_current ?? task.finish_planned)?.slice(0, 10)
    if (!startIso && !finishIso) return true
    if (startIso && startIso <= end && (!finishIso || finishIso >= start)) return true
    return false
  })
}

export async function fetchAllProjectTasks(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('wbs_code', { ascending: true })

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as ProjectTask[]
}

export async function fetchRecentDailyReports(
  supabase: SupabaseClient,
  projectId: string,
  limit = 20
): Promise<SiteDailyReport[]> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as SiteDailyReport[]
}

export async function createDailyReport(
  supabase: SupabaseClient,
  supervisorId: string,
  input: CreateDailyReportInput
): Promise<SiteDailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .insert({
      project_id: input.project_id,
      report_date: input.report_date,
      site_supervisor_id: supervisorId,
      raw_text: input.raw_text.trim(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SiteDailyReport
}

export async function approveDailyReport(
  supabase: SupabaseClient,
  reportId: string,
  managerId: string
): Promise<SiteDailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      approved_by_manager: true,
      approved_at: new Date().toISOString(),
      approved_by: managerId,
    })
    .eq('id', reportId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SiteDailyReport
}

export async function fetchUnresolvedAlerts(
  supabase: SupabaseClient,
  projectId: string,
  limit = 50
): Promise<ProjectAlert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_resolved', false)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []) as ProjectAlert[]
}

export async function fetchProjectScheduleSummary(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectScheduleSummary> {
  const [tasksResult, alertsResult] = await Promise.all([
    supabase
      .from('project_tasks')
      .select('percent_complete, is_critical, finish_planned, schedule_weight, is_summary')
      .eq('project_id', projectId),
    supabase.from('alerts').select('id').eq('project_id', projectId).eq('is_resolved', false),
  ])

  if (tasksResult.error && tasksResult.error.code !== '42P01') {
    throw new Error(tasksResult.error.message)
  }

  type TaskRow = Pick<
    ProjectTask,
    'percent_complete' | 'is_critical' | 'finish_planned' | 'schedule_weight' | 'is_summary'
  >
  const tasks = (tasksResult.data ?? []) as TaskRow[]
  const today = todayIsoDate()

  const leafTasks = tasks.filter((t) => !t.is_summary)

  const completedTasks = leafTasks.filter((t) => Number(t.percent_complete) >= 100).length
  const delayedTasks = leafTasks.filter(
    (t) => Number(t.percent_complete) < 100 && t.finish_planned && t.finish_planned.slice(0, 10) < today
  ).length
  const criticalTasks = leafTasks.filter((t) => t.is_critical).length
  const overallPercentComplete = weightedProgressPercent(
    leafTasks.map((t) => ({
      progress: Number(t.percent_complete) || 0,
      weight: normalizeScheduleWeightPercent(t.schedule_weight),
    }))
  )

  return {
    totalTasks: leafTasks.length,
    completedTasks,
    delayedTasks,
    criticalTasks,
    overallPercentComplete,
    unresolvedAlerts: alertsResult.data?.length ?? 0,
  }
}

/** Stub: will call OpenAI / Edge Function later. */
export async function requestDailyReportAiParse(reportId: string): Promise<{ queued: boolean }> {
  const response = await fetch('/api/schedule/parse-daily-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_report_id: reportId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? 'AI parse request failed')
  }

  return response.json()
}
