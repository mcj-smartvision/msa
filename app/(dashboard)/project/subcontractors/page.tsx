/**
 * @file app/(dashboard)/project/subcontractors/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, shared/lib/dashboard/load-role-page, features/schedule/lib/access, features/admin/components/shared, features/project-manager/components/pm-subcontractors-page-client
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/lib/supabase/server'
import { loadRolePageData } from '@/shared/lib/dashboard/load-role-page'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import { PageHeader } from '@/features/admin/components/shared'
import { PmSubcontractorsPageClient } from '@/features/project-manager/components/pm-subcontractors-page-client'
import { PROJECT_MANAGER_PAGE_COPY } from '@/features/project-manager/config'

export default async function ProjectSubcontractorsPage() {
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
    hasRoleDashboardAccess(context, 'project-manager') ||
    context.positionKeys.includes('finance_admin')

  if (!canAccess) redirect('/dashboard')

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={PROJECT_MANAGER_PAGE_COPY.subcontractorsTitle}
        description={PROJECT_MANAGER_PAGE_COPY.subcontractorsHint}
      />
      <PmSubcontractorsPageClient
        initialContext={context}
        projectOptions={projectOptions}
        initialProjectId={activeProjectId}
      />
    </div>
  )
}
