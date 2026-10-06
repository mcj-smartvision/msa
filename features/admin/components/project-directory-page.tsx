'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { ProjectDirectoryTable } from '@/features/admin/components/project-directory-table'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import type { AdminProject, ProjectMember } from '@/shared/types/admin'

export function ProjectDirectoryPage({
  projects,
  members,
  lastActivityByProjectId,
}: {
  projects: AdminProject[]
  members: ProjectMember[]
  lastActivityByProjectId?: Record<string, string>
}) {
  const { locale } = useLocale()
  const fa = locale === 'fa'

  return (
    <AccountPageShell
      wide
      title={fa ? 'فهرست پروژه‌ها' : 'Project directory'}
      hint={fa ? 'همه پروژه‌ها با شماره ردیف و مشخصات برای ادمین.' : 'All projects with row numbers and details.'}
    >
      <ProjectDirectoryTable
        projects={projects}
        members={members}
        lastActivityByProjectId={lastActivityByProjectId}
        fa={fa}
      />
    </AccountPageShell>
  )
}
