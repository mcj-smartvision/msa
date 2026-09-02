'use client'

import { EmptyState } from '@/components/admin/shared'
import { PmSubcontractorsPanel } from '@/components/project-manager/pm-subcontractors-panel'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import type { DashboardUserContext } from '@/types/dashboard'

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
    return <EmptyState title="پیمانکاران" description="پروژه‌ای تخصیص داده نشده است." />
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
