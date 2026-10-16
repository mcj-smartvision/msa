/**
 * @file features/project-manager/components/pm-subcontractors-page-client.tsx
 * @purpose کامپوننت UI — اتاق فرمان مدیر پروژه و کارتابل (pm-subcontractors-page-client)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on features/admin/components/shared, features/project-manager/components/pm-subcontractors-panel, features/project-manager/config, shared/hooks/use-synced-project-id, shared/types/dashboard
 */

'use client'

import { EmptyState } from '@/features/admin/components/shared'
import { PmSubcontractorsPanel } from '@/features/project-manager/components/pm-subcontractors-panel'
import { PROJECT_MANAGER_PAGE_COPY } from '@/features/project-manager/config'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import type { DashboardUserContext } from '@/shared/types/dashboard'

interface Props {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
}

export function PmSubcontractorsPageClient({
  initialContext,
  projectOptions,
  initialProjectId,
}: Props) {
  const projectId = useSyncedProjectId(initialProjectId)

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={PROJECT_MANAGER_PAGE_COPY.subcontractorsEmptyTitle}
        description={PROJECT_MANAGER_PAGE_COPY.subcontractorsEmptyDescription}
      />
    )
  }

  const projectName =
    projectOptions.find((p) => p.id === projectId)?.name ?? projectOptions[0]?.name ?? ''

  return (
    <div className="space-y-4">
      <PmSubcontractorsPanel
        projectId={projectId ?? projectOptions[0].id}
        projectName={projectName}
        userId={initialContext.userId}
      />
    </div>
  )
}
