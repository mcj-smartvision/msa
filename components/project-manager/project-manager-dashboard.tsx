'use client'

import { useLocale } from '@/components/i18n/locale-provider'
import { EmptyState, PageHeader } from '@/components/admin/shared'
import { getProjectManagerMessages } from '@/lib/i18n/project-manager'
import type { DashboardUserContext } from '@/types/dashboard'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import { cn } from '@/lib/utils'

interface ProjectManagerDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
}

export function ProjectManagerDashboard({
  projectOptions,
  initialProjectId,
}: ProjectManagerDashboardProps) {
  const { locale, dir } = useLocale()
  const t = getProjectManagerMessages(locale)
  useSyncedProjectId(initialProjectId)

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description={
          locale === 'fa' || locale === 'ar'
            ? 'از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند.'
            : 'Ask an admin to assign you as Project Manager on a project.'
        }
      />
    )
  }

  return (
    <div className={cn('space-y-8', dir === 'rtl' && 'text-right')} dir={dir}>
      <PageHeader title={t.title} description={t.description} />
    </div>
  )
}
