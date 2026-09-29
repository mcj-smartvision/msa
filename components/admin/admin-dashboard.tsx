'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useControlCenterDetails } from '@/components/admin/control-center-details-context'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/admin/stat-card'
import { OnlineUsersPanel } from '@/components/admin/online-users-panel'
import { SupportTicketsPanel, CriticalAlertsPanel } from '@/components/admin/support-tickets'
import { RoleDashboardGrid } from '@/components/admin/role-dashboard-grid'
import { ProjectStatusBadge } from '@/components/admin/projects-control/project-row'
import type { DetailKey } from '@/components/admin/control-center-details-context'
import { isAllProjectsScope } from '@/lib/project/project-cookie'
import { openProjectDirectory } from '@/lib/account/open-account-page'
import { formatProjectStamp, sortProjectsRecent } from '@/components/admin/project-directory-table'
import { useLocale } from '@/components/i18n/locale-provider'
import {
  Users,
  UserCheck,
  MapPin,
  AlertCircle,
  FolderKanban,
  Plus,
} from 'lucide-react'

function pageTitleFor(detail: DetailKey | null, fa: boolean): string {
  if (!detail) return fa ? 'نمای کلی' : 'Overview'
  const titles: Record<DetailKey, string> = {
    messages: fa ? 'ساپورت و پیام‌ها' : 'Support & Messages',
    alerts: fa ? 'هشدارهای بحرانی' : 'Critical Alerts',
    roles: fa ? 'دسترسی بر اساس نقش' : 'Access by Role',
    dashboards: fa ? 'داشبورد اعضا' : 'Member Dashboards',
    presence: fa ? 'حضور در سایت' : 'Site Presence',
  }
  return titles[detail]
}

export function AdminDashboard() {
  const { feeds, stats, members, projects, scope, loading, error, openDetail } = useControlCenterDetails()
  const { locale } = useLocale()
  const fa = locale === 'fa'

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

  if (loading) return <LoadingBlock label={fa ? 'در حال بارگذاری نمای شرکت...' : 'Loading company overview...'} />
  if (error || !stats) return <ErrorBlock message={error ?? (fa ? 'بارگذاری داشبورد ممکن نشد' : 'Unable to load dashboard')} />

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
              <Link href="/admin/members/new">{fa ? 'اضافه کردن عضو جدید' : 'Add new member'}</Link>
            </Button>
          ) : null
        }
      />

      {openDetail === 'dashboards' ? null : (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label={fa ? 'کل کاربران' : 'People'}
          value={scoped.uniquePeople || stats.memberCount}
          icon={Users}
          iconTone="info"
          trend={fa ? `${scoped.scopedProjects.length || stats.projectCount} پروژه` : `${scoped.scopedProjects.length || stats.projectCount} projects`}
          trendType="neutral"
          sparkline={feeds.sparkline?.people}
        />
        <StatCard
          compact
          label={fa ? 'کاربران فعال' : 'Active'}
          value={scoped.activeMembers}
          icon={UserCheck}
          iconTone="ok"
          trend={fa ? 'فعال و مجاز' : 'Active members'}
          trendType="up"
          sparkline={feeds.sparkline?.active}
        />
        <StatCard
          compact
          label={fa ? 'حاضر در سایت' : 'On site'}
          value={scoped.inside}
          icon={MapPin}
          iconTone="info"
          trend={
            fa
              ? `${feeds.outsideCount} خارج · ${feeds.absentCount} غایب`
              : `${feeds.outsideCount} left · ${feeds.absentCount} absent`
          }
          trendType="neutral"
          sparkline={feeds.sparkline?.onSite}
        />
        <StatCard
          compact
          label={fa ? 'نیاز به توجه' : 'Needs attention'}
          value={scoped.pendingPassword}
          icon={AlertCircle}
          iconTone={scoped.pendingPassword > 0 ? 'warn' : 'ok'}
          caption={fa ? 'درخواست‌های عضویت در انتظار' : 'Pending first-login memberships'}
          trend={
            scoped.pendingPassword > 0
              ? fa
                ? `${scoped.pendingPassword} رمز در انتظار`
                : `${scoped.pendingPassword} pending passwords`
              : fa
                ? 'موردی نیست'
                : 'All clear'
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
              {fa ? 'فهرست پروژه‌ها' : 'Project list'}
            </button>
            <Link
              href="/admin/projects/new"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {fa ? 'ایجاد پروژه جدید' : 'Create new project'}
            </Link>
          </div>
          <RecentProjectsPreview projects={scoped.scopedProjects} fa={fa} />
        </section>
      )}

      {openDetail === 'dashboards' ? null : (
        <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">{fa ? 'نیاز به رسیدگی' : 'Requires Attention'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fa ? 'هشدارهای فنی زنده' : 'Live technical alerts'}
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
          {fa
            ? 'از نوار کناری می‌توانید پیام‌ها، نقش‌ها و حضور را باز کنید.'
            : 'Use the sidebar to open messages, roles, and presence.'}
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
        <p className="text-sm font-medium text-slate-700">{fa ? 'هنوز پروژه‌ای ثبت نشده' : 'No projects yet'}</p>
        <Link href="/admin/projects/new" className="mt-2 text-[12px] font-medium text-sky-700 hover:underline">
          {fa ? 'ایجاد پروژه' : 'Create a project'}
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
    messages: fa ? 'پشتیبانی و پیام‌ها' : 'Support & Messages',
    alerts: fa ? 'هشدارهای حیاتی' : 'Critical Alerts',
    roles: fa ? 'دسترسی بر اساس نقش' : 'Access by Role',
    dashboards: fa ? 'داشبورد اعضا' : 'Member Dashboards',
    presence: fa ? 'حضور در سایت' : 'Site Presence',
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
