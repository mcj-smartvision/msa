import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { parseDailyReportActivityRef } from '@/features/supervisor/lib/daily-report-activities'

export type SupervisorProgressUpdate = {
  activityId: string
  percentComplete: number
  reportDate?: string
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100))
}

async function updateProjectTask(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  taskId: string,
  pct: number,
  reportDate: string | undefined,
  now: string
): Promise<boolean> {
  const { data: task } = await supabase
    .from('project_tasks')
    .select('id, actual_start, start_current, start_planned')
    .eq('id', taskId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!task) return false

  const patch: Record<string, unknown> = {
    percent_complete: pct,
    physical_percent_complete: pct,
    updated_at: now,
  }
  if (pct > 0 && pct < 100 && !task.actual_start) {
    patch.actual_start =
      task.start_current ?? task.start_planned ?? reportDate ?? now.slice(0, 10)
  }
  if (pct >= 100) {
    patch.actual_finish = reportDate ?? now.slice(0, 10)
  }

  const { data: updated, error } = await supabase
    .from('project_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('project_id', projectId)
    .select('id')
    .maybeSingle()

  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!updated) return false

  // Best-effort history; ignore if RLS/table blocks
  await supabase.from('task_progress_updates').insert({
    project_id: projectId,
    task_id: taskId,
    progress_date: reportDate ?? now.slice(0, 10),
    percent_complete: pct,
    created_by: userId,
  })

  return true
}

async function updateWorkshopPackage(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  packageId: string,
  pct: number,
  reportDate: string | undefined,
  now: string
): Promise<boolean> {
  const { data: pkg } = await supabase
    .from('workshop_packages')
    .select('id, schedule_fields')
    .eq('id', packageId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!pkg) return false

  const fields =
    pkg.schedule_fields && typeof pkg.schedule_fields === 'object'
      ? { ...(pkg.schedule_fields as Record<string, unknown>) }
      : {}
  fields.percent_complete = pct
  fields.physical_percent_complete = pct

  const { data: updated, error } = await supabase
    .from('workshop_packages')
    .update({
      schedule_fields: fields,
      updated_at: now,
    })
    .eq('id', packageId)
    .eq('project_id', projectId)
    .select('id')
    .maybeSingle()

  if (error) throw new WorkshopError('VALIDATION', error.message)
  if (!updated) return false

  // Best-effort history; ignore until migration 99 is applied
  await supabase.from('package_progress_updates').insert({
    project_id: projectId,
    package_id: packageId,
    progress_date: reportDate ?? now.slice(0, 10),
    percent_complete: pct,
    entered_by: userId,
  })

  return true
}

/**
 * Persist supervisor physical progress into schedule rows so
 * ویرایش برنامه + ارسال برنامه read the same values from DB.
 */
export async function persistSupervisorPhysicalProgress(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  updates: SupervisorProgressUpdate[]
): Promise<{ updatedTasks: number; updatedPackages: number }> {
  if (!projectId) throw new WorkshopError('VALIDATION', 'projectId لازم است')
  if (!updates.length) return { updatedTasks: 0, updatedPackages: 0 }

  let updatedTasks = 0
  let updatedPackages = 0
  const now = new Date().toISOString()

  for (const row of updates) {
    const rawId = String(row.activityId ?? '').trim()
    if (!rawId) continue
    const pct = clampPercent(Number(row.percentComplete))
    const ref = parseDailyReportActivityRef(rawId)

    if (ref.kind === 'schedule' || ref.kind === 'unknown') {
      const ok = await updateProjectTask(
        supabase,
        projectId,
        userId,
        ref.entityId,
        pct,
        row.reportDate,
        now
      )
      if (ok) {
        updatedTasks += 1
        continue
      }
      if (ref.kind === 'schedule') continue
    }

    if (ref.kind === 'package' || ref.kind === 'unknown') {
      const ok = await updateWorkshopPackage(
        supabase,
        projectId,
        userId,
        ref.entityId,
        pct,
        row.reportDate,
        now
      )
      if (ok) updatedPackages += 1
    }
  }

  if (updatedTasks + updatedPackages === 0) {
    throw new WorkshopError(
      'VALIDATION',
      'هیچ فعالیت متناظری در برنامه برای ذخیره پیشرفت پیدا نشد'
    )
  }

  try {
    const { persistProjectProgressPace } = await import('@/features/schedule/lib/persist-progress-pace')
    await persistProjectProgressPace(supabase, projectId, {
      statusDate: updates.find((u) => u.reportDate)?.reportDate,
    })
  } catch {
    /* pace columns optional */
  }

  try {
    const { captureProgressSnapshots } = await import('@/features/schedule/lib/progress-snapshots')
    await captureProgressSnapshots(supabase, { projectId, force: true })
  } catch {
    /* progress history optional until migrations 93 and 95 are applied */
  }

  return { updatedTasks, updatedPackages }
}
