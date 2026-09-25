import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadRolePageData } from '@/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/lib/schedule/access'
import { fetchAllProjectTasks, fetchUnresolvedAlerts } from '@/utils/schedule'
import { SiteSupervisorDashboard } from '@/components/schedule/site-supervisor-dashboard'

export default async function SiteSupervisorPage({
  searchParams,
}: {
  searchParams?: { section?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const { context, projectOptions, activeProjectId } = await loadRolePageData(
    supabase,
    user.id,
    user.email
  )

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'site-supervisor')) redirect('/dashboard')

  const [tasks, alerts] = activeProjectId
    ? await Promise.all([
        fetchAllProjectTasks(supabase, activeProjectId),
        fetchUnresolvedAlerts(supabase, activeProjectId),
      ])
    : [[], []]

  return (
    <SiteSupervisorDashboard
      key={activeProjectId ?? 'no-project'}
      initialContext={context}
      projectOptions={projectOptions}
      initialProjectId={activeProjectId}
      initialTasks={tasks}
      initialAlerts={alerts}
      initialSection={
        searchParams?.section === 'inspection'
          ? 'inspection'
          : searchParams?.section === 'drawings'
              ? 'drawings'
              : 'daily-report'
      }
    />
  )
}
