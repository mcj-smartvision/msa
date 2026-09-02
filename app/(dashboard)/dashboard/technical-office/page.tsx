import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadRolePageData } from '@/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/lib/schedule/access'
import { TechnicalOfficeDashboard } from '@/components/technical-office/technical-office-dashboard'
import { ScheduleSendSection } from '@/components/technical-office/schedule-send-section'

function TechnicalOfficeDashboardFallback() {
  return (
    <div className="py-16 text-center text-sm text-slate-600" dir="rtl" lang="fa">
      در حال بارگذاری…
    </div>
  )
}

export default async function TechnicalOfficePage({
  searchParams,
}: {
  searchParams?: { projectId?: string }
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
  if (!hasRoleDashboardAccess(context, 'technical-office')) redirect('/dashboard')

  const resolvedProjectId = searchParams?.projectId ?? activeProjectId

  return (
    <Suspense fallback={<TechnicalOfficeDashboardFallback />}>
      <TechnicalOfficeDashboard
        key={resolvedProjectId ?? 'no-project'}
        initialContext={context}
        projectOptions={projectOptions}
        initialProjectId={resolvedProjectId ?? activeProjectId}
        scheduleSendPanel={
          resolvedProjectId ? <ScheduleSendSection projectId={resolvedProjectId} /> : null
        }
      />
    </Suspense>
  )
}
