'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Briefcase, ChevronLeft } from 'lucide-react'
import {
getRoleDashboardRoute,
memberWorkspaceHref,
ROLE_DASHBOARD_ROUTES,
} from '@/features/admin/lib/role-dashboard-routes'
import { writeProjectCookie } from '@/shared/lib/project/project-cookie'
import { getPositionLabel } from '@/shared/lib/i18n/position-labels'
import type { ProjectMember } from '@/shared/types/admin'
import { cn } from '@/shared/lib/utils'

const ROLE_ORDER = [
  'project_manager',
  'site_supervisor',
  'hse_officer',
  'technical_office',
  'security',
  'storekeeper',
  'procurement_officer',
  'qa_qc_inspector',
  'project_accountant',
]

type View = 'members' | 'positions'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function roleTitleFa(key: string): string {
  return getPositionLabel({ key, title: key }, 'fa')
}

function withProject(href: string, projectId: string | null): string {
  return projectId ? `${href}?projectId=${encodeURIComponent(projectId)}` : href
}

const ROW_CLASS = 'group flex items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50'

function RowArrow() {
  return (
    <ChevronLeft
      className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600"
      aria-hidden
    />
  )
}

/** Member dashboards, browsable by person or by position (positions list even when nobody holds them). */
export function RoleDashboardGrid({
  members,
  projectNames,
  projectId = null,
}: {
  members: ProjectMember[]
  projectNames?: Map<string, string>
  /** Selected project, or null when viewing all projects. */
  projectId?: string | null
}) {
  const [view, setView] = useState<View>('members')

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="نحوهٔ نمایش" className="inline-flex rounded-xl bg-slate-100 p-1">
        {(
          [
            ['members', 'بر اساس اعضا'],
            ['positions', 'بر اساس سمت'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
              view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'members' ? (
        <MemberList members={members} projectNames={projectNames} />
      ) : (
        <PositionList members={members} projectId={projectId} />
      )}
    </div>
  )
}

function MemberList({ members, projectNames }: { members: ProjectMember[]; projectNames?: Map<string, string> }) {
  const rows = members
    .slice()
    .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, 'fa'))
  const multiProject = new Set(rows.map((m) => m.project_id)).size > 1

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">هنوز عضوی تعریف نشده است.</p>
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {rows.map((member) => {
        const roleTitles =
          (member.positions ?? []).map((p) => getPositionLabel(p, 'fa')).join(' · ') || 'سمت تعریف نشده'
        const projectName = multiProject ? projectNames?.get(member.project_id) : undefined
        return (
          <li key={member.id}>
            <Link
              href={memberWorkspaceHref(member)}
              target="_blank"
              rel="noreferrer"
              onClick={() => writeProjectCookie(member.project_id)}
              className={cn(ROW_CLASS, !member.is_active && 'opacity-55')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                {initials(member.full_name || member.email || '?')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{member.full_name || member.email}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {roleTitles}
                  {projectName ? ` · ${projectName}` : ''}
                </p>
              </div>
              {!member.is_active ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  غیرفعال
                </span>
              ) : null}
              <RowArrow />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function PositionList({ members, projectId }: { members: ProjectMember[]; projectId: string | null }) {
  const holders = new Map<string, string[]>()
  for (const member of members) {
    const seen = new Set<string>()
    for (const p of member.positions ?? []) {
      const href = getRoleDashboardRoute(p.key)
      if (!href || seen.has(href)) continue
      seen.add(href)
      holders.set(href, [...(holders.get(href) ?? []), member.full_name || member.email])
    }
  }

  const roles = Object.keys(ROLE_DASHBOARD_ROUTES).sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a)
    const ib = ROLE_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  const rows = [
    { key: 'manager', title: 'مدیر', href: '/dashboard/manager', names: null as string[] | null },
    ...roles.map((key) => {
      const href = ROLE_DASHBOARD_ROUTES[key]
      return { key, title: roleTitleFa(key), href, names: holders.get(href) ?? [] }
    }),
  ]

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {rows.map((row) => (
        <li key={row.key}>
          <Link href={withProject(row.href, projectId)} target="_blank" rel="noreferrer" className={ROW_CLASS}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
              {row.key === 'manager' ? <Briefcase className="h-4 w-4" aria-hidden /> : row.title.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{row.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {row.names == null
                  ? 'داشبورد مدیریتی پروژه'
                  : row.names.length > 0
                    ? row.names.join('، ')
                    : 'هنوز فردی برای این سمت تعریف نشده'}
              </p>
            </div>
            {row.names != null ? (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  row.names.length > 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'
                )}
              >
                {row.names.length > 0 ? `${row.names.length.toLocaleString('fa-IR-u-nu-latn')} نفر` : 'بدون عضو'}
              </span>
            ) : null}
            <RowArrow />
          </Link>
        </li>
      ))}
    </ul>
  )
}
