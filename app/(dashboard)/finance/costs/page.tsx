import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { CostsDashboard } from '@/features/finance/components/costs-dashboard'

export default async function FinanceCostsPage() {
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

  const canAccess =
    context.isSystemAdmin ||
    hasRoleDashboardAccess(context, 'accountant') ||
    context.positionKeys.includes('project_manager')

  if (!canAccess) redirect('/dashboard')

  const canEdit =
    context.isSystemAdmin || context.positionKeys.includes('project_accountant')

  return (
    <CostsDashboard
      key={activeProjectId ?? 'no-project'}
      initialContext={context}
      projectOptions={projectOptions}
      initialProjectId={activeProjectId}
      canEdit={canEdit}
    />
  )
}
