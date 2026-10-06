import type { SupabaseClient } from '@supabase/supabase-js'
import { SCHEDULE_BUCKET, getScheduleStorage } from '@/features/schedule/lib/schedule-files'

const SCHEDULE_ALERT_TYPES = [
  'start_activity',
  'delay_risk',
  'milestone_risk',
  'critical_path',
] as const

/**
 * Remove all schedule task data for a project so a new MSP import starts clean.
 * Workshop packages (technical-office sub-branches) are removed too — they reference
 * deleted MSP tasks and would violate workshop_packages_parent_chk if left orphaned.
 */
export async function wipeProjectScheduleBeforeImport(
  supabase: SupabaseClient,
  projectId: string
): Promise<void> {
  const { error: packagesError } = await supabase
    .from('workshop_packages')
    .delete()
    .eq('project_id', projectId)

  if (packagesError && packagesError.code !== '42P01') {
    throw new Error(packagesError.message)
  }

  // New schedule-engine tables (migration 75) — ignore if missing
  for (const table of [
    'schedule_assignments',
    'schedule_task_segments',
    'schedule_resources',
    'schedule_calendars',
    'schedule_calculations',
    'float_history',
    'schedule_alerts',
  ] as const) {
    const { error } = await supabase.from(table).delete().eq('project_id', projectId)
    if (error && error.code !== '42P01') {
      /* non-fatal for optional tables */
    }
  }

  const { error: progressError } = await supabase
    .from('task_progress_updates')
    .delete()
    .eq('project_id', projectId)

  if (progressError && progressError.code !== '42P01') {
    throw new Error(progressError.message)
  }

  const { error: depsError } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('project_id', projectId)

  if (depsError && depsError.code !== '42P01') {
    throw new Error(depsError.message)
  }

  const { error: tasksError } = await supabase.from('project_tasks').delete().eq('project_id', projectId)

  if (tasksError && tasksError.code !== '42P01') {
    throw new Error(tasksError.message)
  }

  const { error: alertsError } = await supabase
    .from('alerts')
    .delete()
    .eq('project_id', projectId)
    .in('alert_type', [...SCHEDULE_ALERT_TYPES])

  if (alertsError && alertsError.code !== '42P01') {
    throw new Error(alertsError.message)
  }

  try {
    const storage = getScheduleStorage()
    const { data: files } = await storage.storage.from(SCHEDULE_BUCKET).list(projectId, { limit: 200 })
    const paths = (files ?? [])
      .filter((f) => f.name && !f.name.endsWith('/'))
      .map((f) => `${projectId}/${f.name}`)
    if (paths.length > 0) {
      await storage.storage.from(SCHEDULE_BUCKET).remove(paths)
    }
  } catch {
    /* storage cleanup is best-effort */
  }
}
