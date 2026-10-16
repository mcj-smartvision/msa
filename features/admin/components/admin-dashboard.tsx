/**
 * @file features/admin/components/admin-dashboard.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (admin-dashboard)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on features/admin/components/control-center-details-context, features/admin/components/shared, shared/components/ui/button, features/admin/components/stat-card, features/admin/components/online-users-panel, features/admin/components/support-tickets, features/admin/components/role-dashboard-grid, features/admin/components/projects-control/project-row, shared/lib/project/project-cookie, features/account/lib/open-account-page
 */

'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useControlCenterDetails } from '@/features/admin/components/control-center-details-context'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { StatCard } from '@/features/admin/components/stat-card'
import { OnlineUsersPanel } from '@/features/admin/components/online-users-panel'
import { SupportTicketsPanel, CriticalAlertsPanel } from '@/features/admin/components/support-tickets'
import { RoleDashboardGrid } from '@/features/admin/components/role-dashboard-grid'
import { ProjectStatusBadge } from '@/features/admin/components/projects-control/project-row'
import type { DetailKey } from '@/features/admin/components/control-center-details-context'
import { isAllProjectsScope } from '@/shared/lib/project/project-cookie'
import { openProjectDirectory } from '@/features/account/lib/open-account-page'
import { formatProjectStamp, sortProjectsRecent } from '@/features/admin/components/project-directory-table'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { ADMIN_COPY, adminOverview } from '@/features/admin/config'
import {
Users,
UserCheck,
MapPin,
AlertCircle,
FolderKanban,
Plus,
} from 'lucide-react'

function pageTitleFor(detail: DetailKey | null, fa: boolean): string {
  const t = adminOverview(fa)
  if (!detail) return t.overview
  const titles: Record<DetailKey, string> = {
    messages: t.titleMessages,
    alerts: t.titleAlerts,
    roles: t.titleRoles,
    dashboards: t.titleDashboards,
    presence: t.titlePresence,
  }
  return titles[detail]
}

export function AdminDashboard() {
  const { feeds, stats, members, projects, scope, loading, error, openDetail } = useControlCenterDetails()
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const ov = adminOverview(fa)

  const scoped = useMemo(() => {
    const all = isAllProjectsScope(scope)
    const scopedProjects = all ? projects : projects.filter((p) => p.id === scope)
    const scopedMembers = all ? members : members.filter((m) => m.project_id === scope)
    const scopedAlerts = all
      ? feeds.alerts
      : feeds.alerts.filter((a) => !a.projectId || a.projectId === scope)
    const memberIds = new Set(scopedMembers.map((m) => m.user_id))
    const inside = all
      ? feeds.insideCount
      : feeds.presenceUsers.filter((u) => memberIds.has(u.id) && u.status === 'online').length
    const pendingPassword = scopedMembers.filter((m) => !m.password_changed_by_member).length
    const activeMembers = scopedMembers.filter((m) => m.is_active).length
    const uniquePeople = new Set(scopedMembers.map((m) => m.user_id)).size
    return {
      all,
      scopedProjects,
      scopedMembers,
      scopedAlerts,
      inside,
      pendingPassword,
      activeMembers,
      uniquePeople,
    }
  }, [scope, projects, members, feeds])

  if (loading) return <LoadingBlock label={fa ? ADMIN_COPY.loadingCompany : ADMIN_COPY.loadingCompanyEn} />
  if (error || !stats) return <ErrorBlock message={error ?? (fa ? ADMIN_COPY.loadDashboardFailed : ADMIN_COPY.loadDashboardFailedEn)} />

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <PageHeader
        title={pageTitleFor(openDetail, fa)}
        actions={
          openDetail === 'dashboards' ? (
            <Button
              asChild
              className="h-8 border-0 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Link href="/admin/members/new">{ov.addMember}</Link>
            </Button>
          ) : null
        }
      />

      {openDetail === 'dashboards' ? null : (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label={ov.people}
          value={scoped.uniquePeople || stats.memberCount}
          icon={Users}
          iconTone="info"
          trend={ov.projectsCount(scoped.scopedProjects.length || stats.projectCount)}
          trendType="neutral"
          sparkline={feeds.sparkline?.people}
        />
        <StatCard
          compact
          label={ov.active}
          value={scoped.activeMembers}
          icon={UserCheck}
          iconTone="ok"
          trend={ov.activeTrend}
          trendType="up"
          sparkline={feeds.sparkline?.active}
        />
        <StatCard
          compact
          label={ov.onSite}
          value={scoped.inside}
          icon={MapPin}
          iconTone="info"
          trend={ov.outsideAbsent(feeds.outsideCount, feeds.absentCount)}
          trendType="neutral"
          sparkline={feeds.sparkline?.onSite}
        />
        <StatCard
          compact
          label={ov.attention}
          value={scoped.pendingPassword}
          icon={AlertCircle}
          iconTone={scoped.pendingPassword > 0 ? 'warn' : 'ok'}
          caption={ov.pendingMemberships}
          trend={
            scoped.pendingPassword > 0
              ? ov.pendingPasswords(scoped.pendingPassword)
              : ov.allClear
          }
          trendType={scoped.pendingPassword > 0 ? 'warning' : 'up'}
          sparkline={feeds.sparkline?.attention}
        />
      </section>
      )}

      {openDetail === 'alerts' || openDetail === 'dashboards' ? null : (
        <section className="rounded-[12px] border border-[#5a7088] bg-white px-4 py-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openProjectDirectory()}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {ov.projectList}
            </button>
            <Link
              href="/admin/projects/new"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {ov.createProjectNew}
            </Link>
          </div>
          <RecentProjectsPreview projects={scoped.scopedProjects} fa={fa} />
        </section>
      )}

      {openDetail === 'dashboards' ? null : (
        <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">{ov.requiresAttention}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {ov.liveAlerts}
            </p>
          </div>
          <div className="p-4 max-h-[420px] overflow-y-auto">
            <CriticalAlertsPanel alerts={scoped.scopedAlerts} />
          </div>
        </section>
      )}

      <ControlCenterExpandedPanel />

      {openDetail ? null : (
        <p className="hidden lg:block text-[12px] text-sky-800/70 text-center py-2">
          {ov.sidebarHint}
        </p>
      )}
    </div>
  )
}

function RecentProjectsPreview({
  projects,
  fa,
}: {
  projects: ReturnType<typeof useControlCenterDetails>['projects']
  fa: boolean
}) {
  const recent = sortProjectsRecent(projects).slice(0, 3)

  if (recent.length === 0) {
    return (
      <div className="mt-5 flex flex-col items-center justify-center py-6 text-center">
        <FolderKanban className="mb-2 h-8 w-8 text-sky-300" />
        <p className="text-sm font-medium text-slate-700">{adminOverview(fa).noProjects}</p>
        <Link href="/admin/projects/new" className="mt-2 text-[12px] font-medium text-sky-700 hover:underline">
          {adminOverview(fa).createAProject}
        </Link>
      </div>
    )
  }

  return (
    <ul className="mt-5 divide-y divide-slate-100 rounded-[10px] border border-slate-100">
      {recent.map((project, index) => (
        <li key={project.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/projects/${project.id}/members`}
              className="truncate text-sm font-semibold text-sky-800 hover:underline"
            >
              {project.name}
            </Link>
            <p className="text-[11px] text-slate-500">
              {formatProjectStamp(project.created_at, fa)}
              {project.location ? ` · ${project.location}` : ''}
            </p>
          </div>
          <ProjectStatusBadge status={project.status} isActive={project.is_active} />
        </li>
      ))}
    </ul>
  )
}

function ControlCenterExpandedPanel() {
  const { feeds, stats, members, projects, scope, openDetail } = useControlCenterDetails()
  const { locale } = useLocale()
  if (!openDetail || !stats) return null

  const fa = locale === 'fa'
  const ov = adminOverview(fa)
  const all = isAllProjectsScope(scope)
  const scopedMembers = all ? members : members.filter((m) => m.project_id === scope)
  const memberIds = new Set(scopedMembers.map((m) => m.user_id))
  const scopedAlerts = all
    ? feeds.alerts
    : feeds.alerts.filter((a) => !a.projectId || a.projectId === scope)
  const scopedTickets = all
    ? feeds.tickets
    : feeds.tickets.filter((t) => !t.projectId || t.projectId === scope)
  const scopedPresence = all
    ? feeds.presenceUsers
    : feeds.presenceUsers.filter((u) => memberIds.has(u.id))
  const scopedRoleBreakdown = (() => {
    const roleMap = new Map<string, number>()
    for (const member of scopedMembers) {
      for (const pos of member.positions ?? []) {
        roleMap.set(pos.title, (roleMap.get(pos.title) ?? 0) + 1)
      }
    }
    return Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  })()
  const titles: Record<DetailKey, string> = {
    messages: ov.panelMessages,
    alerts: ov.panelAlerts,
    roles: ov.titleRoles,
    dashboards: ov.titleDashboards,
    presence: ov.titlePresence,
  }

  return (
    <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{titles[openDetail]}</h2>
      </div>
      <div className="p-4 max-h-[min(78vh,720px)] overflow-y-auto">
        {openDetail === 'messages' ? <SupportTicketsPanel tickets={scopedTickets} /> : null}
        {openDetail === 'alerts' ? <CriticalAlertsPanel alerts={scopedAlerts} /> : null}
        {openDetail === 'roles' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scopedRoleBreakdown.map((item) => (
              <div key={item.role} className="rounded-[10px] bg-sky-50 px-4 py-3">
                <p className="text-[11px] text-sky-800">{item.role}</p>
                <p className="text-xl font-semibold tracking-tight mt-1 tabular-nums">{item.count}</p>
              </div>
            ))}
          </div>
        ) : null}
        {openDetail === 'dashboards' ? (
          <RoleDashboardGrid
            members={scopedMembers}
            projectNames={new Map(projects.map((p) => [p.id, p.name]))}
            projectId={all ? null : scope}
          />
        ) : null}
        {openDetail === 'presence' ? <OnlineUsersPanel users={scopedPresence} /> : null}
      </div>
    </section>
  )
}
