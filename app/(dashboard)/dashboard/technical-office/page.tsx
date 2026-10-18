/**
 * @file app/(dashboard)/dashboard/technical-office/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, features/technical-office/components/technical-office-dashboard, features/technical-office/components/schedule-send-section
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { TechnicalOfficeDashboard } from '@/features/technical-office/components/technical-office-dashboard'
import { ScheduleSendSection } from '@/features/technical-office/components/schedule-send-section'
import { COMMON_UI } from '@/shared/lib/i18n/common-ui'

export const dynamic = 'force-dynamic'

function TechnicalOfficeDashboardFallback() {
  return (
    <div className="py-16 text-center text-sm text-slate-600">
      {COMMON_UI.loading}
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
