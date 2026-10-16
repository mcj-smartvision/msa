/**
 * @file features/admin/components/project-directory-page.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (project-directory-page)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on features/account/components/account-page-shell, features/admin/components/project-directory-table, features/admin/config, shared/components/i18n/locale-provider, shared/types/admin
 */

'use client'

import { AccountPageShell } from '@/features/account/components/account-page-shell'
import { ProjectDirectoryTable } from '@/features/admin/components/project-directory-table'
import { ADMIN_DIRECTORY_COPY, pickAdminLocale } from '@/features/admin/config'
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
  const dir = pickAdminLocale(fa, ADMIN_DIRECTORY_COPY)

  return (
    <AccountPageShell wide title={dir.pageTitle} hint={dir.pageHint}>
      <ProjectDirectoryTable
        projects={projects}
        members={members}
        lastActivityByProjectId={lastActivityByProjectId}
        fa={fa}
      />
    </AccountPageShell>
  )
}
