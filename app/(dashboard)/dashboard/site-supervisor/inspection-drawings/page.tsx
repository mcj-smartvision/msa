import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { QcOfficeDrawingsPage } from '@/features/qc/components/qc-office-drawings-page'

export default async function SiteSupervisorInspectionDrawingsPage({
  searchParams,
}: {
  searchParams?: { projectId?: string; returnTo?: string; requestId?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const { context, activeProjectId } = await loadRolePageData(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'site-supervisor')) redirect('/dashboard')

  const resolvedProjectId = searchParams?.projectId ?? activeProjectId

  return (
    <QcOfficeDrawingsPage
      projectId={resolvedProjectId}
      returnTo={searchParams?.returnTo}
      requestId={searchParams?.requestId}
    />
  )
}
