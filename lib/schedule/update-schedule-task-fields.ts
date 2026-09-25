import type { SupabaseClient } from '@supabase/supabase-js'
import { toIsoDateOnly } from '@/lib/schedule/dates'
import {
  applyDateChangeWithSuccessorCascade,
  type CascadeDependency,
} from '@/lib/schedule/cascade-successors'
import { durationDaysFromRange } from '@/lib/schedule/gantt-parent-expand'
import { DEFAULT_MSP_MINUTES_PER_DAY } from '@/lib/schedule/predecessor-format'
import type { TaskRelationType } from '@/types/schedule'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { getWorkshopCapabilities } from '@/lib/workshop/service'
import { WorkshopError } from '@/lib/workshop/domain'

/**
 * Update schedule task dates, total_float, schedule_weight, and/or predecessor label
 * (برنامه table → گانت / catch-up / progress sync).
 * Date edits cascade to dependency successors (and WBS parents).
 */
export async function updateScheduleTaskFields(
  supabase: SupabaseClient,
  input: {
    projectId: string
    taskId: string
    startDate?: string | null
    finishDate?: string | null
    totalFloat?: number | null
    scheduleWeight?: number | null
    predecessorLabel?: string | null
  }
): Promise<{
  updated: Array<{ id: string; startDate: string; finishDate: string; durationDays: number }>
  totalFloat: number | null
  scheduleWeight: number | null
  predecessorLabel?: string
}> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, input.projectId)
  const capabilities = await getWorkshopCapabilities(supabase, input.projectId)
  if (!capabilities.canWrite) {
    throw new WorkshopError('FORBIDDEN', 'اجازه ویرایش برنامه را ندارید')
  }

  let updated: Array<{ id: string; startDate: string; finishDate: string; durationDays: number }> =
    []
  let totalFloat: number | null =
    input.totalFloat === undefined || input.totalFloat === null
      ? null
      : Number(input.totalFloat)
  let scheduleWeight: number | null =
    input.scheduleWeight === undefined || input.scheduleWeight === null
      ? null
      : Number(input.scheduleWeight)
  let predecessorLabel: string | undefined

  const wantsDates = input.startDate != null || input.finishDate != null
  if (wantsDates) {
    const [{ data: tasks, error }, { data: deps, error: depsError }] = await Promise.all([
      supabase
        .from('project_tasks')
        .select(
          'id, parent_id, wbs_code, is_summary, start_planned, finish_planned, start_current, finish_current'
        )
        .eq('project_id', input.projectId),
      supabase
        .from('task_dependencies')
        .select('predecessor_task_id, successor_task_id, relation_type, lag_duration')
        .eq('project_id', input.projectId),
    ])
    if (error) throw new WorkshopError('VALIDATION', error.message)
    if (depsError) throw new WorkshopError('VALIDATION', depsError.message)

    const current = (tasks ?? []).find((t) => t.id === input.taskId)
    if (!current) throw new WorkshopError('NOT_FOUND', 'فعالیت پیدا نشد')

    const fallbackStart =
      toIsoDateOnly(current.start_current) ?? toIsoDateOnly(current.start_planned)
    const fallbackFinish =
      toIsoDateOnly(current.finish_current) ?? toIsoDateOnly(current.finish_planned)

    const start = toIsoDateOnly(input.startDate) ?? fallbackStart
    const finish = toIsoDateOnly(input.finishDate) ?? fallbackFinish

    if (!start || !finish) {
      throw new WorkshopError('VALIDATION', 'تاریخ شروع و پایان لازم است')
    }
    if (finish < start) {
      throw new WorkshopError('VALIDATION', 'پایان نمی‌تواند قبل از شروع باشد')
    }

    const nodes = (tasks ?? []).map((t) => {
      const s = toIsoDateOnly(t.start_current) ?? toIsoDateOnly(t.start_planned) ?? start
      const f = toIsoDateOnly(t.finish_current) ?? toIsoDateOnly(t.finish_planned) ?? finish
      return {
        id: t.id as string,
        parentId: (t.parent_id as string | null) ?? null,
        wbs: (t.wbs_code as string | null)?.trim() || null,
        start: s,
        finish: f,
        isSummary: Boolean(t.is_summary),
      }
    })

    const dayLen = DEFAULT_MSP_MINUTES_PER_DAY
    const cascadeDeps: CascadeDependency[] = (deps ?? []).map((d) => ({
      predecessorId: d.predecessor_task_id as string,
      successorId: d.successor_task_id as string,
      type: (d.relation_type as TaskRelationType) || 'FS',
      lagDays:
        Number(d.lag_duration) && dayLen > 0
          ? Math.round(Number(d.lag_duration) / dayLen)
          : 0,
    }))

    const changed = applyDateChangeWithSuccessorCascade(
      nodes,
      input.taskId,
      start,
      finish,
      cascadeDeps
    )
    for (const row of changed) {
      const durationDays = durationDaysFromRange(row.start, row.finish)
      const patch: Record<string, unknown> = {
        start_current: `${row.start}T12:00:00.000Z`,
        finish_current: `${row.finish}T12:00:00.000Z`,
        duration_days: durationDays,
        start_planned: `${row.start}T12:00:00.000Z`,
        finish_planned: `${row.finish}T12:00:00.000Z`,
      }
      const { error: updError } = await supabase
        .from('project_tasks')
        .update(patch)
        .eq('id', row.id)
        .eq('project_id', input.projectId)
      if (updError) throw new WorkshopError('VALIDATION', updError.message)
    }
    updated = changed.map((row) => ({
      id: row.id,
      startDate: row.start,
      finishDate: row.finish,
      durationDays: durationDaysFromRange(row.start, row.finish),
    }))
  }

  if (input.totalFloat !== undefined) {
    const tf =
      input.totalFloat === null || input.totalFloat === ('' as unknown)
        ? null
        : Number(input.totalFloat)
    if (tf != null && (!Number.isFinite(tf) || tf < -3650 || tf > 3650)) {
      throw new WorkshopError('VALIDATION', 'شناوری نامعتبر است')
    }
    totalFloat = tf

    const { data: existing } = await supabase
      .from('schedule_calculations')
      .select('id, early_start, early_finish, late_start, late_finish, project_duration_days')
      .eq('project_id', input.projectId)
      .eq('task_id', input.taskId)
      .maybeSingle()

    const isCritical = tf != null && Math.abs(tf) < 1e-9
    const row = {
      project_id: input.projectId,
      task_id: input.taskId,
      early_start: Number(existing?.early_start) || 0,
      early_finish: Number(existing?.early_finish) || 0,
      late_start: Number(existing?.late_start) || (tf ?? 0),
      late_finish: Number(existing?.late_finish) || (tf ?? 0),
      total_float: tf ?? 0,
      is_critical: isCritical,
      project_duration_days: Number(existing?.project_duration_days) || 0,
      calculated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('schedule_calculations')
      .upsert(row, { onConflict: 'project_id,task_id' })
    if (upsertError) {
      throw new WorkshopError('VALIDATION', `ذخیره شناوری ناموفق: ${upsertError.message}`)
    }

    await supabase
      .from('project_tasks')
      .update({ total_float_days: tf, is_critical: isCritical })
      .eq('id', input.taskId)
      .eq('project_id', input.projectId)
  }

  if (input.scheduleWeight !== undefined) {
    const sw =
      input.scheduleWeight === null || input.scheduleWeight === ('' as unknown)
        ? null
        : Number(input.scheduleWeight)
    if (sw != null && (!Number.isFinite(sw) || sw < 0 || sw > 10000)) {
      throw new WorkshopError('VALIDATION', 'وزن نامعتبر است')
    }
    scheduleWeight = sw

    const { error: weightError } = await supabase
      .from('project_tasks')
      .update({ schedule_weight: sw, physical_weight: sw })
      .eq('id', input.taskId)
      .eq('project_id', input.projectId)

    if (weightError) {
      if (/schedule_weight/i.test(weightError.message)) {
        throw new WorkshopError(
          'VALIDATION',
          'ستون schedule_weight در دیتابیس وجود ندارد — migration 66 را در Supabase اجرا کنید.'
        )
      }
      throw new WorkshopError('VALIDATION', `ذخیره وزن ناموفق: ${weightError.message}`)
    }
  }

  if (input.predecessorLabel !== undefined) {
    const { replaceTaskPredecessorsFromLabel } = await import(
      '@/lib/schedule/replace-task-predecessors'
    )
    const result = await replaceTaskPredecessorsFromLabel(
      supabase,
      input.projectId,
      input.taskId,
      String(input.predecessorLabel ?? '')
    )
    predecessorLabel = result.label
  }

  return { updated, totalFloat, scheduleWeight, predecessorLabel }
}
