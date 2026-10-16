/**
 * @file app/(native-app)/accountant-app/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, features/finance/components/accountant-native-app
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { AccountantNativeApp } from '@/features/finance/components/accountant-native-app'

/** Android / mobile accountant shell — full financial dashboard over the internet. */
export default async function AccountantNativeAppPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login?redirect=/accountant-app')

  const { context, projectOptions, activeProjectId } = await loadRolePageData(
    supabase,
    user.id,
    user.email
  )

  if (context.isFirstLogin) redirect('/first-login')
  if (!hasRoleDashboardAccess(context, 'accountant') && !context.isSystemAdmin) {
    redirect('/dashboard')
  }

  const canEdit =
    context.isSystemAdmin ||
    context.positionKeys.includes('project_accountant') ||
    context.positionKeys.includes('finance_admin')

  return (
    <AccountantNativeApp
      key={activeProjectId ?? 'no-project'}
      initialContext={context}
      projectOptions={projectOptions}
      initialProjectId={activeProjectId}
      canEdit={canEdit}
    />
  )
}
