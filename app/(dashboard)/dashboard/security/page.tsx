import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { hasRoleDashboardAccess } from '@/lib/schedule/access'
import { PROJECT_COOKIE } from '@/lib/project/project-cookie'
import { SecurityDashboard } from '@/components/security/security-dashboard'

export default async function SecurityDashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'security')) redirect('/dashboard')

  let projectOptions = context.projects.map((p) => ({ id: p.project.id, name: p.project.name }))

  if (projectOptions.length === 0 && context.isSystemAdmin) {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    projectOptions = (data ?? []) as { id: string; name: string }[]
  }

  const cookieProjectId = cookies().get(PROJECT_COOKIE)?.value ?? null
  const activeProjectId =
    projectOptions.find((p) => p.id === cookieProjectId)?.id ??
    context.activeProjectId ??
    projectOptions[0]?.id ??
    null

  return (
    <SecurityDashboard
      key={activeProjectId ?? 'no-project'}
      initialContext={context}
      projectOptions={projectOptions}
      initialProjectId={activeProjectId}
    />
  )
}
