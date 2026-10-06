import type { SupabaseClient } from '@supabase/supabase-js'

export async function writeSiteOpsAudit(
  supabase: SupabaseClient,
  params: {
    projectId: string
    actorId: string | null
    action: string
    entityType: string
    entityId?: string | null
    payload?: Record<string, unknown>
  }
) {
  await supabase.from('site_ops_audit_log').insert({
    project_id: params.projectId,
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    payload: params.payload ?? {},
  })
}
