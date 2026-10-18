/**
 * @file features/manager/lib/page-props.ts
 * @purpose منطق دامنه — داشبورد مدیر پروژه و KPI (page-props)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, shared/lib/dashboard/roles, features/manager/lib/manager-nav
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { SITE_ROLE_LABELS } from '@/shared/lib/dashboard/roles'
import { buildManagerNav, type ManagerNavModel } from '@/features/manager/lib/manager-nav'
import { getManagerNavCopy } from '@/features/manager/lib/i18n/nav-copy'
import { LOCALE_COOKIE } from '@/shared/lib/i18n/locale-cookie'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'

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

  const cookieStore = await cookies()
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const navCopy = getManagerNavCopy(locale)

  const roleLabel =
    !context.positionKeys.includes('project_manager') && context.isSystemAdmin
      ? navCopy.systemAdminRole
      : SITE_ROLE_LABELS.project_manager

  return {
    user: {
      id: context.userId,
      name: context.fullName || context.email,
      email: user.email,
      roleLabel,
      isAdmin: context.isSystemAdmin,
    },
    nav: buildManagerNav(context, locale),
    projectOptions,
    initialProjectId: activeProjectId,
  }
}
