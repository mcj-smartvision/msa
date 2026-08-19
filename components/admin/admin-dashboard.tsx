'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useControlCenterDetails } from '@/components/admin/control-center-details-context'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { OnlineUsersPanel } from '@/components/admin/online-users-panel'
import { SupportTicketsPanel, CriticalAlertsPanel } from '@/components/admin/support-tickets'
import { RoleDashboardGrid } from '@/components/admin/role-dashboard-grid'
import { ProjectStatusBadge } from '@/components/admin/projects-control/project-row'
import type { DetailKey } from '@/components/admin/control-center-details-context'
import { estimateProgress } from '@/lib/admin/project-status'
import { isAllProjectsScope } from '@/lib/project/project-cookie'
import { APP_NAME, APP_PRODUCT_LINE } from '@/lib/brand'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'
import {
  Users,
  UserCheck,
  MapPin,
  AlertCircle,
  FolderKanban,
  ArrowLeft,
} from 'lucide-react'

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

  const currentName = scoped.all
    ? fa
      ? 'همه پروژه‌ها'
      : 'All Projects'
    : scoped.scopedProjects[0]?.name ?? (fa ? 'پروژه' : 'Project')

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <PageHeader
        title={fa ? 'نمای کلی شرکت' : 'Company Overview'}
        description={
          fa
            ? `${APP_NAME} · ${APP_PRODUCT_LINE} پایش پرتفوی پروژه‌ها، تیم و ریسک‌های اجرایی.`
            : `${APP_NAME} · ${APP_PRODUCT_LINE}`
        }
      />

      <p className="text-[12px] text-slate-500 -mt-2">
        {fa ? 'زمینه فعلی' : 'Current context'}
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="font-medium text-slate-800">{currentName}</span>
      </p>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          compact
          label={fa ? 'کل کاربران' : 'People'}
          value={scoped.uniquePeople || stats.memberCount}
          icon={Users}
          trend={fa ? `${scoped.scopedProjects.length || stats.projectCount} پروژه` : `${scoped.scopedProjects.length || stats.projectCount} projects`}
        />
        <StatCard
          compact
          label={fa ? 'کاربران فعال' : 'Active'}
          value={scoped.activeMembers}
          icon={UserCheck}
          trend={fa ? 'فعال و مجاز' : 'Active members'}
          trendType="up"
        />
        <StatCard
          compact
          label={fa ? 'حاضر در سایت' : 'On site'}
          value={scoped.inside}
          icon={MapPin}
          trend={
            fa
              ? `${feeds.outsideCount} خارج · ${feeds.absentCount} غایب`
              : `${feeds.outsideCount} left · ${feeds.absentCount} absent`
          }
          trendType={scoped.inside > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          compact
          label={fa ? 'نیاز به توجه' : 'Needs attention'}
          value={scoped.pendingPassword + scoped.scopedAlerts.length}
          icon={AlertCircle}
          trend={
            scoped.pendingPassword > 0
              ? fa
                ? `${scoped.pendingPassword} رمز در انتظار`
                : `${scoped.pendingPassword} pending passwords`
              : fa
                ? 'هشدارها و پیام‌ها'
                : 'Alerts and messages'
          }
          trendType={scoped.pendingPassword + scoped.scopedAlerts.length > 0 ? 'warning' : 'up'}
        />
      </section>

      <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{fa ? 'پرتفوی پروژه‌ها' : 'Project Portfolio'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fa
                ? 'شرکت → همه پروژه‌ها → پروژه → تیم'
                : 'Company → All Projects → Project → Team'}
            </p>
          </div>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            {fa ? 'مدیریت پروژه‌ها' : 'Manage'}
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
        <PortfolioTable
          projects={scoped.scopedProjects}
          members={members}
          alerts={feeds.alerts}
          fa={fa}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">{fa ? 'نیاز به رسیدگی' : 'Requires Attention'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fa ? 'هشدارهای حل‌نشده از داده زنده' : 'Unresolved live alerts'}
            </p>
          </div>
          <div className="p-4 max-h-[420px] overflow-y-auto">
            <CriticalAlertsPanel alerts={scoped.scopedAlerts} />
          </div>
        </section>

        <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">{fa ? 'فعالیت اخیر' : 'Recent Activity'}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fa ? 'گزارش‌ها، گیت و پیام‌های ثبت‌شده' : 'Reports, gate events, and messages'}
            </p>
          </div>
          <div className="p-4 max-h-[420px] overflow-y-auto">
            <ActivityFeed activities={feeds.activities} />
          </div>
        </section>
      </div>

      <ControlCenterExpandedPanel />

      {openDetail ? null : (
        <p className="hidden lg:block text-[12px] text-muted-foreground text-center py-2">
          {fa
            ? 'از نوار کناری می‌توانید پیام‌ها، نقش‌ها و حضور را باز کنید.'
            : 'Use the sidebar to open messages, roles, and presence.'}
        </p>
      )}
    </div>
  )
}

function PortfolioTable({
  projects,
  members,
  alerts,
  fa,
}: {
  projects: ReturnType<typeof useControlCenterDetails>['projects']
  members: ReturnType<typeof useControlCenterDetails>['members']
  alerts: ReturnType<typeof useControlCenterDetails>['feeds']['alerts']
  fa: boolean
}) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <FolderKanban className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-700">{fa ? 'هنوز پروژه‌ای ثبت نشده' : 'No projects yet'}</p>
        <Link href="/admin/projects" className="mt-2 text-[12px] font-medium text-primary hover:underline">
          {fa ? 'ایجاد پروژه' : 'Create a project'}
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-start text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-4 py-2.5 font-semibold">{fa ? 'پروژه' : 'Project'}</th>
            <th className="px-3 py-2.5 font-semibold">{fa ? 'وضعیت' : 'Status'}</th>
            <th className="px-3 py-2.5 font-semibold">{fa ? 'پیشرفت' : 'Progress'}</th>
            <th className="px-3 py-2.5 font-semibold">{fa ? 'تیم' : 'Team'}</th>
            <th className="px-3 py-2.5 font-semibold">{fa ? 'هشدار' : 'Alerts'}</th>
            <th className="px-4 py-2.5 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const team = members.filter((m) => m.project_id === project.id)
            const uniqueTeam = new Set(team.map((m) => m.user_id)).size
            const alertCount = alerts.filter((a) => a.projectId === project.id).length
            const progress = estimateProgress(project.status, project.is_active)
            return (
              <tr key={project.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{project.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {[project.code, project.location].filter(Boolean).join(' · ') || '—'}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <ProjectStatusBadge status={project.status} isActive={project.is_active} />
                </td>
                <td className="px-3 py-3 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-[12px] font-semibold text-slate-700">{progress}٪</span>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums text-slate-700">
                  {uniqueTeam} {fa ? 'نفر' : ''}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      alertCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    )}
                  >
                    {alertCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  <Link
                    href={`/admin/projects/${project.id}/members`}
                    className="text-[12px] font-medium text-primary hover:underline"
                  >
                    {fa ? 'تیم' : 'Team'}
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ControlCenterExpandedPanel() {
  const { feeds, stats, members, openDetail } = useControlCenterDetails()
  const { locale } = useLocale()
  if (!openDetail || !stats) return null

  const fa = locale === 'fa'
  const titles: Record<DetailKey, string> = {
    messages: fa ? 'پشتیبانی و پیام‌ها' : 'Support & Messages',
    alerts: fa ? 'هشدارهای حیاتی' : 'Critical Alerts',
    roles: fa ? 'دسترسی بر اساس نقش' : 'Access by Role',
    dashboards: fa ? 'داشبورد اعضا' : 'Member Dashboards',
    activity: fa ? 'فعالیت اخیر' : 'Recent Activity',
    presence: fa ? 'حضور در سایت' : 'Site Presence',
  }

  return (
    <section className="rounded-[12px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{titles[openDetail]}</h2>
      </div>
      <div className="p-4 max-h-[min(78vh,720px)] overflow-y-auto">
        {openDetail === 'messages' ? <SupportTicketsPanel tickets={feeds.tickets} /> : null}
        {openDetail === 'alerts' ? <CriticalAlertsPanel alerts={feeds.alerts} /> : null}
        {openDetail === 'roles' && stats.roleBreakdown ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.roleBreakdown.map((item) => (
              <div key={item.role} className="rounded-[10px] bg-slate-50 px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{item.role}</p>
                <p className="text-xl font-semibold tracking-tight mt-1 tabular-nums">{item.count}</p>
              </div>
            ))}
          </div>
        ) : null}
        {openDetail === 'dashboards' ? <RoleDashboardGrid members={members} /> : null}
        {openDetail === 'activity' ? <ActivityFeed activities={feeds.activities} /> : null}
        {openDetail === 'presence' ? <OnlineUsersPanel users={feeds.presenceUsers} /> : null}
      </div>
    </section>
  )
}
