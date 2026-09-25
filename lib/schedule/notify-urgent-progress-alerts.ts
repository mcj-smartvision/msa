import type { SupabaseClient } from '@supabase/supabase-js'

const NOTIFY_POSITION_KEYS = new Set([
  'project_manager',
  'technical_office',
  'planning_engineer',
  'site_manager',
  'civil_engineer',
])

/**
 * In-app push (app_notifications) for new urgent progress alerts — one batch per recompute.
 */
export async function notifyUrgentProgressAlerts(
  supabase: SupabaseClient,
  projectId: string,
  alerts: Array<{ activityId: string; activityName: string; message: string }>
): Promise<number> {
  if (alerts.length === 0) return 0

  const { data: members, error } = await supabase
    .from('project_members')
    .select('user_id, positions(key)')
    .eq('project_id', projectId)
    .eq('is_active', true)

  if (error || !members?.length) return 0

  const userIds = new Set<string>()
  for (const row of members) {
    const uid = row.user_id as string | null
    if (!uid) continue
    const keys = ((row.positions as Array<{ key?: string }>) ?? [])
      .map((p) => p.key)
      .filter(Boolean) as string[]
    if (keys.some((k) => NOTIFY_POSITION_KEYS.has(k))) {
      userIds.add(uid)
    }
  }

  if (userIds.size === 0) return 0

  const title =
    alerts.length === 1
      ? 'هشدار فوری پیشرفت'
      : `${alerts.length} هشدار فوری پیشرفت`
  const body =
    alerts.length === 1
      ? alerts[0].message.slice(0, 200)
      : alerts
          .slice(0, 3)
          .map((a) => a.activityName)
          .join('، ')
          .slice(0, 200)

  const rows = [...userIds].map((user_id) => ({
    user_id,
    project_id: projectId,
    title,
    body,
    notification_type: 'warning' as const,
    href: `/dashboard/technical-office?projectId=${projectId}&section=smart-progress`,
    related_entity_type: 'schedule_urgent_progress',
    related_entity_id: alerts[0]?.activityId ?? null,
  }))

  const { error: insertError } = await supabase.from('app_notifications').insert(rows)
  if (insertError) return 0
  return rows.length
}
