import type { SupabaseClient } from '@supabase/supabase-js'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { resolvePrimaryRole } from '@/shared/lib/dashboard/roles'
import type { AdminProject, ProjectMember } from '@/shared/types/admin'
import type { DashboardProjectContext, DashboardUserContext } from '@/shared/types/dashboard'

export async function fetchDashboardUserContext(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  preferredProjectId?: string | null
): Promise<DashboardUserContext> {
  const [profileResult, admin, membershipsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_first_login')
      .eq('id', userId)
      .maybeSingle(),
    isSystemAdmin(supabase, userId),
    supabase
      .from('v_project_members_with_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true),
  ])

  const profile = profileResult.data
  const members = (membershipsResult.data ?? []) as ProjectMember[]

  const projectIds = [...new Set(members.map((m) => m.project_id))]
  let projects: AdminProject[] = []

  if (projectIds.length > 0) {
    const { data } = await supabase.from('projects').select('*').in('id', projectIds).eq('is_active', true)
    projects = (data ?? []) as AdminProject[]
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]))
  const projectContexts: DashboardProjectContext[] = members
    .filter((m) => projectMap.has(m.project_id))
    .map((m) => ({
      project: projectMap.get(m.project_id)!,
      memberId: m.id,
      positions: m.positions ?? [],
    }))

  const positionKeys = [
    ...new Set(projectContexts.flatMap((ctx) => ctx.positions.map((p) => p.key))),
  ]

  const activeProjectId =
    preferredProjectId && projectContexts.some((c) => c.project.id === preferredProjectId)
      ? preferredProjectId
      : projectContexts[0]?.project.id ?? null

  const memberRecord = members.find((m) => m.password_changed_by_member === false)
  const needsPasswordChangeFromMember = Boolean(memberRecord)

  return {
    userId,
    email,
    fullName: profile?.full_name ?? email.split('@')[0],
    isFirstLogin: profile?.is_first_login ?? needsPasswordChangeFromMember,
    isSystemAdmin: admin,
    primaryRole: resolvePrimaryRole(positionKeys),
    positionKeys,
    projects: projectContexts,
    activeProjectId,
  }
}
