/**
 * @file features/admin/components/project-directory-table.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (project-directory-table)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on features/admin/components/projects-control/project-row, features/admin/config, shared/types/admin, shared/lib/utils
 */

'use client'

import Link from 'next/link'
import { ProjectStatusBadge } from '@/features/admin/components/projects-control/project-row'
import { ADMIN_DIRECTORY_COPY, pickAdminLocale } from '@/features/admin/config'
import type { AdminProject, ProjectMember } from '@/shared/types/admin'
import { cn } from '@/shared/lib/utils'

export function formatProjectStamp(iso?: string | null, fa = true): string {
  const dir = pickAdminLocale(fa, ADMIN_DIRECTORY_COPY)
  if (!iso) return dir.none
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return dir.none
  return d.toLocaleString(fa ? 'fa-IR-u-nu-latn' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export function sortProjectsRecent(projects: AdminProject[]): AdminProject[] {
  return [...projects].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })
}

export function ProjectDirectoryTable({
  projects,
  members,
  lastActivityByProjectId,
  fa,
}: {
  projects: AdminProject[]
  members: ProjectMember[]
  lastActivityByProjectId?: Record<string, string>
  fa: boolean
}) {
  const dir = pickAdminLocale(fa, ADMIN_DIRECTORY_COPY)
  const rows = sortProjectsRecent(projects)

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        {dir.empty}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
            <th className="px-3 py-2.5 text-start">{dir.row}</th>
            <th className="px-3 py-2.5 text-start">{dir.project}</th>
            <th className="px-3 py-2.5 text-start">{dir.status}</th>
            <th className="px-3 py-2.5 text-start">{dir.created}</th>
            <th className="px-3 py-2.5 text-start">{dir.lastActivity}</th>
            <th className="px-3 py-2.5 text-start">{dir.team}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project, index) => {
            const team = members.filter((m) => m.project_id === project.id)
            const uniqueTeam = new Set(team.map((m) => m.user_id)).size
            const href = `/admin/projects/${project.id}/members`
            return (
              <tr key={project.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 text-start tabular-nums text-slate-500">{index + 1}</td>
                <td className="px-3 py-3 text-start">
                  <Link href={href} className="font-semibold text-sky-800 hover:underline">
                    {project.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {[project.code, project.location].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-3 py-3 text-start">
                  <ProjectStatusBadge status={project.status} isActive={project.is_active} />
                </td>
                <td className="px-3 py-3 text-start text-[12px] tabular-nums text-slate-700">
                  {formatProjectStamp(project.created_at, fa)}
                </td>
                <td className="px-3 py-3 text-start text-[12px] tabular-nums text-slate-700">
                  {formatProjectStamp(lastActivityByProjectId?.[project.id], fa)}
                </td>
                <td className={cn('px-3 py-3 text-start tabular-nums text-slate-700')}>
                  {uniqueTeam} {dir.people}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
