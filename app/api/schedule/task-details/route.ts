import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { assertProjectAccess, requireUser } from '@/features/site-ops/lib/auth'
import { updateScheduleTaskFields } from '@/features/schedule/lib/update-schedule-task-fields'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { getWorkshopCapabilities, workshopErrorResponse } from '@/features/workshop/lib/service'

const TEXT_FIELDS = new Set([
  'name',
  'obs_code',
  'cbs_code',
  'constraint_type',
  'notes',
  'uom',
])
const NUMBER_FIELDS = new Set([
  'baseline_cost',
  'baseline_work_hours',
  'percent_complete',
  'physical_percent_complete',
  'work_hours',
  'cost',
  'fixed_cost',
  'unit_price',
  'quantity',
  'priority',
])
const DATE_FIELDS = new Set([
  'constraint_date',
  'deadline',
  'baseline_start',
  'baseline_finish',
  'actual_start',
  'actual_finish',
])
const BOOLEAN_FIELDS = new Set([
  'flag',
  'is_manual_scheduled',
])
const CONSTRAINT_TYPES = new Set(['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'])

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = String(body.projectId ?? '')
    const taskId = String(body.taskId ?? '')
    const field = String(body.field ?? '')
    const rawValue = body.value
    if (!projectId || !taskId || !field) {
      return NextResponse.json({ error: 'projectId، taskId و field لازم است' }, { status: 400 })
    }

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertProjectAccess(supabase, user.id, projectId)
    const capabilities = await getWorkshopCapabilities(supabase, projectId)
    if (!capabilities.canWrite) {
      throw new WorkshopError('FORBIDDEN', 'اجازه ویرایش برنامه را ندارید')
    }

    if (field === 'quantity_certainty') {
      const value = String(rawValue ?? '')
      if (value !== 'حدودی' && value !== 'قطعی') {
        throw new WorkshopError('VALIDATION', 'وضعیت مقدار باید حدودی یا قطعی باشد')
      }
      const { error } = await supabase
        .from('project_tasks')
        .update({ quantity_certainty: value })
        .eq('id', taskId)
        .eq('project_id', projectId)
      if (error) throw new WorkshopError('VALIDATION', error.message)
    } else if (field === 'start_planned' || field === 'finish_planned') {
      await updateScheduleTaskFields(supabase, {
        projectId,
        taskId,
        ...(field === 'start_planned'
          ? { startDate: rawValue ? String(rawValue) : null }
          : { finishDate: rawValue ? String(rawValue) : null }),
      })
    } else if (field === 'total_float_days') {
      await updateScheduleTaskFields(supabase, {
        projectId,
        taskId,
        totalFloat: rawValue === '' || rawValue == null ? null : Number(rawValue),
      })
    } else if (field === 'physical_weight') {
      await updateScheduleTaskFields(supabase, {
        projectId,
        taskId,
        scheduleWeight: rawValue === '' || rawValue == null ? null : Number(rawValue),
      })
    } else {
      let value: string | number | boolean | null
      if (TEXT_FIELDS.has(field)) {
        value = rawValue == null || String(rawValue).trim() === '' ? null : String(rawValue).trim()
        if (field === 'name' && value == null) {
          throw new WorkshopError('VALIDATION', 'نام نمی‌تواند خالی باشد')
        }
        if (field === 'constraint_type' && value != null && !CONSTRAINT_TYPES.has(value)) {
          throw new WorkshopError('VALIDATION', 'نوع قید زمان‌بندی نامعتبر است')
        }
      } else if (NUMBER_FIELDS.has(field)) {
        const numberValue = rawValue === '' || rawValue == null ? null : Number(rawValue)
        if (numberValue != null && !Number.isFinite(numberValue)) {
          throw new WorkshopError('VALIDATION', 'مقدار عددی نامعتبر است')
        }
        if (
          (field === 'percent_complete' || field === 'physical_percent_complete') &&
          numberValue != null &&
          (numberValue < 0 || numberValue > 100)
        ) {
          throw new WorkshopError('VALIDATION', 'درصد باید بین صفر و صد باشد')
        }
        if (
          numberValue != null &&
          field !== 'priority' &&
          field !== 'percent_complete' &&
          field !== 'physical_percent_complete' &&
          numberValue < 0
        ) {
          throw new WorkshopError('VALIDATION', 'مقدار نمی‌تواند منفی باشد')
        }
        if (
          field === 'priority' &&
          numberValue != null &&
          (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 1000)
        ) {
          throw new WorkshopError('VALIDATION', 'اولویت باید عدد صحیح بین صفر و 1000 باشد')
        }
        value = numberValue
      } else if (DATE_FIELDS.has(field)) {
        value = rawValue ? `${String(rawValue).slice(0, 10)}T12:00:00.000Z` : null
        if (
          field === 'baseline_start' ||
          field === 'baseline_finish' ||
          field === 'actual_start' ||
          field === 'actual_finish'
        ) {
          const { data: current, error: currentError } = await supabase
            .from('project_tasks')
            .select('baseline_start, baseline_finish, actual_start, actual_finish')
            .eq('id', taskId)
            .eq('project_id', projectId)
            .single()
          if (currentError) throw new WorkshopError('VALIDATION', currentError.message)
          const start =
            field === 'baseline_start'
              ? value
              : field === 'actual_start'
                ? value
                : field.startsWith('baseline')
                  ? current.baseline_start
                  : current.actual_start
          const finish =
            field === 'baseline_finish'
              ? value
              : field === 'actual_finish'
                ? value
                : field.startsWith('baseline')
                  ? current.baseline_finish
                  : current.actual_finish
          if (start && finish && String(finish).slice(0, 10) < String(start).slice(0, 10)) {
            throw new WorkshopError('VALIDATION', 'تاریخ پایان نمی‌تواند قبل از شروع باشد')
          }
        }
      } else if (BOOLEAN_FIELDS.has(field)) {
        value = Boolean(rawValue)
      } else {
        throw new WorkshopError('VALIDATION', 'این ستون محاسباتی است و مستقیم ویرایش نمی‌شود')
      }

      const { error } = await supabase
        .from('project_tasks')
        .update({ [field]: value })
        .eq('id', taskId)
        .eq('project_id', projectId)
      if (error) throw new WorkshopError('VALIDATION', error.message)
      // Official rebaseline: only a baseline (or weight) change rebuilds Planned.
      // Progress snapshots never take this branch, so Planned stays fixed.
      if (
        field === 'baseline_start' ||
        field === 'baseline_finish' ||
        field === 'physical_weight' ||
        field === 'schedule_weight'
      ) {
        try {
          const { persistPlannedWeights } = await import('@/features/schedule/lib/persist-planned-weights')
          await persistPlannedWeights(supabase, projectId, taskId)
        } catch {
          /* planned weights optional until migration 94 */
        }
      }
      if (field === 'physical_weight' || field === 'schedule_weight') {
        try {
          const { persistEarnedWeights } = await import('@/features/schedule/lib/persist-earned-weights')
          await persistEarnedWeights(supabase, projectId)
        } catch {
          /* earned weights optional until migration 95 */
        }
      }
      if (field === 'unit_price') {
        await supabase
          .from('contractor_activity_statements')
          .update({ unit_price: value, updated_at: new Date().toISOString() })
          .eq('project_id', projectId)
          .eq('entity_type', 'task')
          .eq('entity_id', taskId)
      }
    }

    const { data: task, error: reloadError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single()
    if (reloadError) throw new WorkshopError('VALIDATION', reloadError.message)
    return NextResponse.json({ task })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
