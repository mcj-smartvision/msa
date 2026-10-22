/**
 * @file features/admin/components/admin-nav.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (admin-nav)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/components/brand/brand-logo, shared/lib/utils, shared/components/auth/logout-button, shared/components/i18n/locale-provider, shared/components/layout/header-user-controls, features/admin/components/control-center-details-context, features/admin/lib/role-dashboard-routes, shared/lib/i18n/position-labels, shared/lib/project/project-cookie, features/admin/config
 */

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
LayoutDashboard,
Users,
FolderKanban,
Settings,
MessageSquare,
AlertCircle,
ClipboardCheck,
CalendarRange,
Briefcase,
ChevronDown,
type LucideIcon,
} from 'lucide-react'
import { BrandLogo } from '@/shared/components/brand/brand-logo'
import { cn } from '@/shared/lib/utils'
import { LogoutButton } from '@/shared/components/auth/logout-button'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { HeaderUserControls } from '@/shared/components/layout/header-user-controls'
import {
useControlCenterDetailsOptional,
ControlCenterDataProvider,
type DetailKey,
} from '@/features/admin/components/control-center-details-context'
import { groupMembersByRoleDashboard } from '@/features/admin/lib/role-dashboard-routes'
import { getPositionLabel } from '@/shared/lib/i18n/position-labels'
import { isAllProjectsScope } from '@/shared/lib/project/project-cookie'
import { ADMIN_NAV_COPY } from '@/features/admin/config'

const NAV_ROW =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900'

const NAV_ROW_ACTIVE = 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'

export function AdminShell({ children, email }: { children: ReactNode; email?: string }) {
  return (
    <ControlCenterDataProvider>
      <AdminShellFrame email={email}>{children}</AdminShellFrame>
    </ControlCenterDataProvider>
  )
}

function AdminShellFrame({ children, email }: { children: ReactNode; email?: string }) {
  return (
    <div className="flex min-h-screen bg-[#5a7088]">
      <aside className="hidden lg:flex w-[260px] flex-col border-e border-slate-200/90 bg-white shrink-0">
        <div className="flex h-14 items-center border-b border-slate-100 px-3">
          <BrandLogo size="md" />
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <AdminFlatNav />
        </nav>

        <div className="border-t border-slate-100 p-3">
          <LogoutButton label={ADMIN_NAV_COPY.logout} className="w-full h-9 rounded-[10px]" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopHeader email={email} />

        <div className="lg:hidden border-b bg-white px-2 py-2 overflow-x-auto">
          <nav className="min-w-[280px]">
            <AdminFlatNav compact />
          </nav>
        </div>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function AdminTopHeader({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur">
      <BrandLogo size="sm" />
      <HeaderUserControls email={email} allowAllProject showLanguage />
    </header>
  )
}

function AdminFlatNav({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useControlCenterDetailsOptional()
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const loc = fa ? ADMIN_NAV_COPY.fa : ADMIN_NAV_COPY.en
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ dashboards: true })

  const openDetail = ctx?.openDetail ?? null
  const feeds = ctx?.feeds
  const allProjects = isAllProjectsScope(ctx?.scope)
  const scopedMembers = useMemo(() => {
    const members = ctx?.members ?? []
    if (allProjects) return members
    return members.filter((m) => m.project_id === ctx?.scope)
  }, [allProjects, ctx?.members, ctx?.scope])
  const scopedProjects = useMemo(() => {
    const projects = ctx?.projects ?? []
    if (allProjects) return projects
    return projects.filter((p) => p.id === ctx?.scope)
  }, [allProjects, ctx?.projects, ctx?.scope])
  const roleGroups = useMemo(() => groupMembersByRoleDashboard(scopedMembers), [scopedMembers])

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  const selectDetail = useCallback(
    (key: DetailKey) => {
      if (!ctx) return
      if (pathname !== '/admin') {
        ctx.setOpenDetail(key)
        router.push('/admin')
        return
      }
      ctx.toggleDetail(key)
    },
    [ctx, pathname, router]
  )

  const goControlCenter = useCallback(() => {
    ctx?.setOpenDetail(null)
    if (pathname !== '/admin') router.push('/admin')
  }, [ctx, pathname, router])

  const linkActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const dashboardsOpen = openGroups.dashboards ?? pathname.startsWith('/dashboard/')
  const projectsOpen = openGroups.projects ?? pathname.startsWith('/admin/projects')

  return (
    <div className={cn(compact ? 'flex flex-wrap gap-1' : 'space-y-1')}>
      <FlatAction
        label={loc.controlCenter}
        icon={LayoutDashboard}
        active={pathname === '/admin' && openDetail === null}
        onClick={goControlCenter}
      />
      <FlatLink
        href="/dashboard/manager"
        label={loc.manager}
        icon={Briefcase}
        active={linkActive('/dashboard/manager')}
      />
      <NavGroup
        label={loc.projects}
        icon={FolderKanban}
        count={scopedProjects.length}
        active={linkActive('/admin/projects')}
        open={projectsOpen}
        onToggle={() => toggleGroup('projects')}
      >
        {scopedProjects.map((project) => (
          <NestedLink
            key={project.id}
            href={`/admin/projects/${project.id}`}
            label={project.name}
            active={pathname.startsWith(`/admin/projects/${project.id}`)}
          />
        ))}
        <NestedLink
          href="/admin/projects"
          label={loc.allProjects}
          active={pathname === '/admin/projects'}
        />
      </NavGroup>
      <FlatLink
        href="/dashboard/qc"
        label={loc.qualityControl}
        icon={ClipboardCheck}
        active={linkActive('/dashboard/qc')}
      />
      <FlatLink
        href="/dashboard/schedule-intelligence"
        label={loc.scheduleIntelligence}
        icon={CalendarRange}
        active={linkActive('/dashboard/schedule-intelligence')}
      />
      <NavGroup
        label={loc.memberDashboards}
        icon={Users}
        count={roleGroups.length}
        active={openDetail === 'dashboards' || roleGroups.some((g) => linkActive(g.href))}
        open={dashboardsOpen}
        onToggle={() => toggleGroup('dashboards')}
      >
        {roleGroups.map((group) => {
          const title = getPositionLabel({ key: group.roleKey, title: group.roleKey }, fa ? 'fa' : 'en')
          return (
            <NestedLink
              key={group.roleKey}
              href={group.href}
              label={title}
              active={linkActive(group.href)}
            />
          )
        })}
        <button
          type="button"
          onClick={() => selectDetail('dashboards')}
          className={cn(NESTED_ROW, openDetail === 'dashboards' && 'bg-slate-100 font-semibold text-slate-900')}
        >
          {loc.fullMemberList}
        </button>
      </NavGroup>
      <FlatAction
        label={loc.supportMessages}
        icon={MessageSquare}
        count={feeds?.tickets.length}
        active={openDetail === 'messages'}
        onClick={() => selectDetail('messages')}
      />
      <FlatAction
        label={loc.criticalAlerts}
        icon={AlertCircle}
        count={feeds?.alerts.length}
        warn={(feeds?.alerts.length ?? 0) > 0}
        active={openDetail === 'alerts'}
        onClick={() => selectDetail('alerts')}
      />
      <FlatLink
        href="/settings"
        label={loc.settings}
        icon={Settings}
        active={linkActive('/settings')}
      />
    </div>
  )
}

const NESTED_ROW =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-[12px] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'

function FlatLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
}) {
  return (
    <Link href={href} className={cn(NAV_ROW, active && NAV_ROW_ACTIVE)}>
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="min-w-0 flex-1 truncate text-start">{label}</span>
    </Link>
  )
}

function FlatAction({
  label,
  icon: Icon,
  count,
  active,
  warn,
  onClick,
}: {
  label: string
  icon: LucideIcon
  count?: number
  active?: boolean
  warn?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={cn(NAV_ROW, active && NAV_ROW_ACTIVE)}>
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="min-w-0 flex-1 truncate text-start">{label}</span>
      <NavCount count={count} active={active} warn={warn} />
    </button>
  )
}

function NavCount({ count, active, warn }: { count?: number; active?: boolean; warn?: boolean }) {
  if (typeof count !== 'number') return null
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
        active
          ? 'bg-white/20 text-inherit'
          : warn
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-100 text-slate-700'
      )}
    >
      {count.toLocaleString('fa-IR-u-nu-latn')}
    </span>
  )
}

function NavGroup({
  label,
  icon: Icon,
  count,
  active,
  open,
  onToggle,
  children,
}: {
  label: string
  icon: LucideIcon
  count?: number
  active?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(NAV_ROW, active && NAV_ROW_ACTIVE)}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" />
        <span className="min-w-0 flex-1 truncate text-start">{label}</span>
        <NavCount count={count} active={active} />
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-80 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="ms-3 mt-0.5 space-y-0.5 border-s border-slate-200 ps-2">{children}</div>
      ) : null}
    </div>
  )
}

function NestedLink({
  href,
  label,
  hint,
  active,
  count,
  indent,
  muted,
  onNavigate,
}: {
  href: string
  label: string
  hint?: string
  active?: boolean
  count?: number
  indent?: boolean
  muted?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        NESTED_ROW,
        indent && 'ps-4 text-[11px]',
        active && 'bg-slate-100 font-semibold text-slate-900',
        muted && 'opacity-55'
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        {label}
        {hint ? <span className="text-slate-400"> · {hint}</span> : null}
      </span>
      <NavCount count={count} />
    </Link>
  )
}

interface ProjectNavProps {
  projectId: string
  projectName: string
}

export function ProjectAdminNav({ projectId, projectName }: ProjectNavProps) {
  const pathname = usePathname()
  const base = `/admin/projects/${projectId}`

  const items = [
    { href: `${base}/members`, label: ADMIN_NAV_COPY.members },
    { href: `${base}/positions`, label: ADMIN_NAV_COPY.positions },
    { href: `${base}/routing`, label: ADMIN_NAV_COPY.routing },
    { href: `${base}/widgets`, label: ADMIN_NAV_COPY.widgets },
  ]

  return (
    <div className="rounded-[12px] border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{ADMIN_NAV_COPY.project}</p>
        <h2 className="text-base font-semibold mt-0.5">{projectName}</h2>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
