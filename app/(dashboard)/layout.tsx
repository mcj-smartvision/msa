import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { buildProjectOptions } from '@/lib/dashboard/load-role-page'
import { getRoleNavLinks } from '@/lib/dashboard/role-nav'
import { PROJECT_COOKIE } from '@/lib/project/project-cookie'
import { DashboardLayoutShell } from '@/components/layout/dashboard-layout-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const cookieProjectId = cookies().get(PROJECT_COOKIE)?.value ?? null
  const admin = await isSystemAdmin(supabase, user.id)
  const context = await fetchDashboardUserContext(
    supabase,
    user.id,
    user.email ?? '',
    cookieProjectId
  )
  const roleNavLinks = getRoleNavLinks(context)
  const projectOptions = await buildProjectOptions(supabase, context)

  return (
    <DashboardLayoutShell
      email={user.email ?? ''}
      isAdmin={admin}
      roleNavLinks={roleNavLinks}
      projectOptions={projectOptions}
    >
      {children}
    </DashboardLayoutShell>
  )
}
