import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadRolePageData } from '@/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/lib/schedule/access'
import { QcOfficeDrawingsPage } from '@/components/qc/qc-office-drawings-page'

export default async function QcOfficeDrawingsRoute({
  searchParams,
}: {
  searchParams?: { returnTo?: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const { context, activeProjectId } = await loadRolePageData(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'qc')) redirect('/dashboard')

  return <QcOfficeDrawingsPage projectId={activeProjectId} returnTo={searchParams?.returnTo} />
}
