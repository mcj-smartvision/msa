import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AiActionRow,
  AiActionType,
  AiStatus,
  DailyReportInput,
} from '@/lib/supervisor/types'
import type { SiteDailyReport } from '@/types/schedule'
import { generateAiActionText, generateDailyReportSummary } from '@/lib/supervisor/ai-generator'

export async function fetchSupervisorAiDrafts(
  supabase: SupabaseClient,
  projectId: string,
  supervisorId: string
): Promise<AiActionRow[]> {
  const { data, error } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('project_id', projectId)
    .eq('supervisor_id', supervisorId)
    .in('status', ['draft_by_ai', 'confirmed_by_user'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }
  return (data ?? []) as AiActionRow[]
}

export async function createAiActionDraft(
  supabase: SupabaseClient,
  params: {
    type: AiActionType
    projectId: string
    supervisorId: string
    payload: Record<string, unknown>
    relatedTaskId?: string
    locale?: 'fa' | 'en'
  }
): Promise<AiActionRow> {
  const text = await generateAiActionText(params.type, params.payload, params.locale ?? 'fa')

  const { data, error } = await supabase
    .from('ai_actions')
    .insert({
      type: params.type,
      project_id: params.projectId,
      supervisor_id: params.supervisorId,
      related_task_id: params.relatedTaskId ?? null,
      payload: params.payload,
      text_generated: text,
      status: 'draft_by_ai',
      created_by: params.supervisorId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AiActionRow
}

export async function updateAiActionText(
  supabase: SupabaseClient,
  actionId: string,
  text: string
): Promise<AiActionRow> {
  const { data, error } = await supabase
    .from('ai_actions')
    .update({ text_generated: text })
    .eq('id', actionId)
    .eq('status', 'draft_by_ai')
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AiActionRow
}

export async function confirmAiAction(
  supabase: SupabaseClient,
  actionId: string,
  supervisorId: string
): Promise<AiActionRow> {
  const { data: existing, error: fetchError } = await supabase
    .from('ai_actions')
    .select('type')
    .eq('id', actionId)
    .eq('supervisor_id', supervisorId)
    .single()

  if (fetchError) throw new Error(fetchError.message)

  const needsPmReview = ['purchase_request', 'subcontractor_instruction', 'hse_alert'].includes(
    existing.type as string
  )

  const { data, error } = await supabase
    .from('ai_actions')
    .update({
      status: 'confirmed_by_user' satisfies AiStatus,
      confirmed_by: supervisorId,
      confirmed_at: new Date().toISOString(),
      pm_status: needsPmReview ? 'pending' : 'not_required',
    })
    .eq('id', actionId)
    .eq('supervisor_id', supervisorId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AiActionRow
}

export async function rejectAiAction(
  supabase: SupabaseClient,
  actionId: string,
  supervisorId: string
): Promise<AiActionRow> {
  const { data, error } = await supabase
    .from('ai_actions')
    .update({ status: 'rejected_by_user' satisfies AiStatus })
    .eq('id', actionId)
    .eq('supervisor_id', supervisorId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as AiActionRow
}

export async function submitQuickReport(
  supabase: SupabaseClient,
  input: DailyReportInput,
  locale: 'fa' | 'en' = 'fa'
): Promise<{ report: SiteDailyReport; summaryText: string; reusedExisting: boolean }> {
  const activityLines = input.activities.map(
    (a) =>
      `Task ${a.scheduleActivityId}: ${a.actualStatus} ${a.actualProgressPercent}% quality=${a.qualityStatus}`
  )
  const newRawChunk = [input.supervisorNote ?? '', ...activityLines].filter(Boolean).join('\n')

  const summaryText = await generateDailyReportSummary(input, locale)

  // One report per project + day + supervisor (daily_reports_unique_day)
  const { data: existing, error: existingError } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('project_id', input.siteId)
    .eq('report_date', input.date)
    .eq('site_supervisor_id', input.supervisorId)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    throw new Error(existingError.message)
  }

  let report: SiteDailyReport
  let reusedExisting = false

  if (existing) {
    reusedExisting = true
    const prevRaw = String(existing.raw_text ?? '').trim()
    const mergedRaw = [prevRaw, newRawChunk].filter(Boolean).join('\n\n')
    const { data: updated, error: updateError } = await supabase
      .from('daily_reports')
      .update({
        raw_text: mergedRaw,
        summary_text: summaryText,
        ai_status: 'draft_by_ai',
        ai_parsed: { summary: summaryText, tasks: [], issues: [], risks: [], materials: [] },
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)
    report = updated as SiteDailyReport
  } else {
    const { data: inserted, error: reportError } = await supabase
      .from('daily_reports')
      .insert({
        project_id: input.siteId,
        report_date: input.date,
        site_supervisor_id: input.supervisorId,
        raw_text: newRawChunk,
        summary_text: summaryText,
        ai_status: 'draft_by_ai',
        ai_parsed: { summary: summaryText, tasks: [], issues: [], risks: [], materials: [] },
      })
      .select()
      .single()

    if (reportError) {
      // Race: another insert won unique constraint — load existing and continue as update once
      if (reportError.code === '23505' || /daily_reports_unique_day/i.test(reportError.message)) {
        const { data: raced } = await supabase
          .from('daily_reports')
          .select('*')
          .eq('project_id', input.siteId)
          .eq('report_date', input.date)
          .eq('site_supervisor_id', input.supervisorId)
          .maybeSingle()
        if (!raced) throw new Error(reportError.message)
        const prevRaw = String(raced.raw_text ?? '').trim()
        const mergedRaw = [prevRaw, newRawChunk].filter(Boolean).join('\n\n')
        const { data: updated, error: updateError } = await supabase
          .from('daily_reports')
          .update({
            raw_text: mergedRaw,
            summary_text: summaryText,
            ai_status: 'draft_by_ai',
            ai_parsed: { summary: summaryText, tasks: [], issues: [], risks: [], materials: [] },
          })
          .eq('id', raced.id)
          .select()
          .single()
        if (updateError) throw new Error(updateError.message)
        report = updated as SiteDailyReport
        reusedExisting = true
      } else {
        throw new Error(reportError.message)
      }
    } else {
      report = inserted as SiteDailyReport
    }
  }

  if (input.activities.length > 0) {
    for (const a of input.activities) {
      const { data: existingAct } = await supabase
        .from('daily_report_activities')
        .select('id')
        .eq('daily_report_id', report.id)
        .eq('schedule_activity_id', a.scheduleActivityId)
        .maybeSingle()

      const actPayload = {
        planned_status: a.plannedStatus,
        actual_status: a.actualStatus,
        actual_progress_percent: a.actualProgressPercent,
        quality_status: a.qualityStatus,
        issues: a.issues,
      }

      if (existingAct?.id) {
        const { error: actError } = await supabase
          .from('daily_report_activities')
          .update(actPayload)
          .eq('id', existingAct.id)
        if (actError && actError.code !== '42P01') throw new Error(actError.message)
      } else {
        const { error: actError } = await supabase.from('daily_report_activities').insert({
          daily_report_id: report.id,
          schedule_activity_id: a.scheduleActivityId,
          ...actPayload,
        })
        if (actError && actError.code !== '42P01') throw new Error(actError.message)
      }

      await supabase.from('task_progress_updates').insert({
        project_id: input.siteId,
        task_id: a.scheduleActivityId,
        report_id: report.id,
        progress_date: input.date,
        percent_complete: a.actualProgressPercent,
        note: a.issues.length ? JSON.stringify(a.issues) : null,
        created_by: input.supervisorId,
      })

      // Keep schedule task % in sync with quick report; seed actual_start on first progress
      const { data: existingTask } = await supabase
        .from('project_tasks')
        .select('actual_start, start_current, start_planned')
        .eq('id', a.scheduleActivityId)
        .eq('project_id', input.siteId)
        .maybeSingle()

      const taskPatch: Record<string, unknown> = {
        percent_complete: a.actualProgressPercent,
        physical_percent_complete: a.actualProgressPercent,
        updated_at: new Date().toISOString(),
      }
      if (
        a.actualProgressPercent > 0 &&
        a.actualProgressPercent < 100 &&
        !existingTask?.actual_start
      ) {
        taskPatch.actual_start =
          existingTask?.start_current ??
          existingTask?.start_planned ??
          input.date
      }

      await supabase
        .from('project_tasks')
        .update(taskPatch)
        .eq('id', a.scheduleActivityId)
        .eq('project_id', input.siteId)
    }

    try {
      const { persistProjectProgressPace } = await import('@/lib/schedule/persist-progress-pace')
      await persistProjectProgressPace(supabase, input.siteId, {
        statusDate: input.date,
      })
    } catch {
      // ignore if pace columns missing
    }
  }

  return { report, summaryText, reusedExisting }
}

export async function confirmDailyReportDraft(
  supabase: SupabaseClient,
  reportId: string,
  supervisorId: string,
  editedSummary?: string
): Promise<SiteDailyReport> {
  const patch: Record<string, unknown> = {
    ai_status: 'confirmed_by_user',
  }
  if (editedSummary !== undefined) {
    patch.summary_text = editedSummary
    patch.ai_parsed = { summary: editedSummary }
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update(patch)
    .eq('id', reportId)
    .eq('site_supervisor_id', supervisorId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SiteDailyReport
}

export async function rejectDailyReportDraft(
  supabase: SupabaseClient,
  reportId: string,
  supervisorId: string
): Promise<SiteDailyReport> {
  const { data, error } = await supabase
    .from('daily_reports')
    .update({ ai_status: 'rejected_by_user' })
    .eq('id', reportId)
    .eq('site_supervisor_id', supervisorId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SiteDailyReport
}
