import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { SITE_ROLE_LABELS } from '@/shared/lib/dashboard/roles'
import { buildManagerNav, type ManagerNavModel } from '@/features/manager/lib/manager-nav'

export interface ManagerPageProps {
  user: { id: string; name: string; email: string; roleLabel: string; isAdmin: boolean }
  nav: ManagerNavModel
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
}

/** Shared guard + props for every page under /dashboard/manager. */
export async function loadManagerPageProps(): Promise<ManagerPageProps> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const { context, projectOptions, activeProjectId } = await loadRolePageData(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'manager')) redirect('/dashboard')

  const roleLabel =
    !context.positionKeys.includes('project_manager') && context.isSystemAdmin
      ? 'مدیر سامانه'
      : SITE_ROLE_LABELS.project_manager

  return {
    user: {
      id: context.userId,
      name: context.fullName || context.email,
      email: user.email,
      roleLabel,
      isAdmin: context.isSystemAdmin,
    },
    nav: buildManagerNav(context),
    projectOptions,
    initialProjectId: activeProjectId,
  }
}
