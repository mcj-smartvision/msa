/**
 * @file app/(dashboard)/dashboard/qc/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, features/qc/components/qc-dashboard
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { QcDashboard } from '@/features/qc/components/qc-dashboard'

export default async function QcDashboardPage() {
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
  if (!hasRoleDashboardAccess(context, 'qc')) redirect('/dashboard')

  return (
    <QcDashboard
      key={activeProjectId ?? 'no-project'}
      initialContext={context}
      projectOptions={projectOptions}
      initialProjectId={activeProjectId}
    />
  )
}
