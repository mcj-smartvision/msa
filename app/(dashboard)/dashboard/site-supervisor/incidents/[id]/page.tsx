import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { IncidentDetailPage } from '@/features/hse/components/incident-detail-page'

/** جزئیات حادثه برای سرپرست کارگاه — بدون layout HSE */
export default async function SiteSupervisorIncidentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  const { context } = await loadRolePageData(supabase, user.id, user.email)

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'site-supervisor')) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <IncidentDetailPage id={params.id} />
    </div>
  )
}
