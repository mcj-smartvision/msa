/**
 * @file app/(dashboard)/dashboard/site-supervisor/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, features/schedule/services/schedule, features/schedule/components/site-supervisor-dashboard
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { fetchAllProjectTasks, fetchUnresolvedAlerts } from '@/features/schedule/services/schedule'
import { SiteSupervisorDashboard } from '@/features/schedule/components/site-supervisor-dashboard'

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
              : searchParams?.section === 'report-background'
                ? 'report-background'
                : searchParams?.section === 'store'
                  ? 'store'
                  : searchParams?.section === 'holidays'
                    ? 'holidays'
                    : 'daily-report'
      }
    />
  )
}
