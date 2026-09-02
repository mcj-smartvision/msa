import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { PROJECT_COOKIE } from '@/lib/project/project-cookie'
import { resolveActiveProjectId } from '@/lib/project/resolve-active-project'
import type { DashboardUserContext } from '@/types/dashboard'

export interface RolePageData {
  context: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  activeProjectId: string | null
}

/** Project list for header switcher and role dashboards. */
export async function buildProjectOptions(
  supabase: SupabaseClient,
  context: DashboardUserContext
): Promise<{ id: string; name: string }[]> {
  let projectOptions = context.projects.map((p) => ({ id: p.project.id, name: p.project.name }))

  // System admin / finance_admin can switch any active project (header switcher lists all).
  const canSeeAllProjects =
    context.isSystemAdmin || context.positionKeys.includes('finance_admin')

  if (canSeeAllProjects) {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    if (data?.length) {
      projectOptions = data as { id: string; name: string }[]
    }
  }

  return projectOptions
}

/** Shared loader for role dashboards (matches storekeeper page pattern). */
export async function loadRolePageData(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<RolePageData> {
  const cookieProjectId = cookies().get(PROJECT_COOKIE)?.value ?? null
  const context = await fetchDashboardUserContext(
    supabase,
    userId,
    email,
    cookieProjectId
  )

  const projectOptions = await buildProjectOptions(supabase, context)
  const activeProjectId = resolveActiveProjectId(projectOptions, cookieProjectId)

  return { context, projectOptions, activeProjectId }
}
