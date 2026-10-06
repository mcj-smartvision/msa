import type { SupabaseClient } from '@supabase/supabase-js'
import { isSystemAdmin } from '@/features/admin/lib/access'
import {
mapSitePilotPositionToSiteOpsRoles,
type SiteOpsRole,
} from '@/features/site-ops/domain'
import { SiteOpsError } from '@/features/site-ops/domain/errors'

export async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new SiteOpsError('FORBIDDEN', 'Unauthorized')
  return user
}

export async function assertProjectAccess(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
) {
  const admin = await isSystemAdmin(supabase, userId)
  if (admin) return { admin: true as const }

  const { data: member } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) throw new SiteOpsError('FORBIDDEN', 'Not a project member')
  return { admin: false as const }
}

export async function resolveSiteOpsRoles(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  positionKeys: string[] = []
): Promise<SiteOpsRole[]> {
  const admin = await isSystemAdmin(supabase, userId)
  if (admin) {
    return ['SITE_MANAGER', 'PROJECT_CONTROLS', 'SUPERVISOR', 'PLANNER', 'TECHNICAL_OFFICE', 'PM']
  }

  const roles = new Set<SiteOpsRole>(mapSitePilotPositionToSiteOpsRoles(positionKeys))

  const { data: grants } = await supabase
    .from('site_ops_role_grants')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)

  for (const g of grants ?? []) {
    if (g.role) roles.add(g.role as SiteOpsRole)
  }

  if (roles.size === 0) roles.add('VIEWER')
  return [...roles]
}

export async function loadMemberPositionKeys(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('v_project_members_with_positions')
    .select('positions')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  const positions = (data?.positions ?? []) as Array<{ key?: string }>
  return positions.map((p) => p.key).filter((k): k is string => Boolean(k))
}
