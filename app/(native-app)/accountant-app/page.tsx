import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadRolePageData } from '@/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/lib/schedule/access'
import { AccountantNativeApp } from '@/components/finance/accountant-native-app'

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
