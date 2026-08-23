'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  MessageSquare,
  AlertCircle,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { cn } from '@/lib/utils'
import { LogoutButton } from '@/components/auth/logout-button'
import { useLocale } from '@/components/i18n/locale-provider'
import { HeaderLanguageSwitcher } from '@/components/i18n/header-language-switcher'
import { HeaderProjectSwitcher } from '@/components/project/header-project-switcher'
import { HeaderUserMenu } from '@/components/account/header-user-menu'
import { MessengerButton } from '@/components/messaging/messenger-panel'
import {
  useControlCenterDetailsOptional,
  ControlCenterDataProvider,
  type DetailKey,
} from '@/components/admin/control-center-details-context'

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
          <LogoutButton label="خروج" className="w-full h-9 rounded-[10px]" />
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
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur">
      <div className="flex min-w-0 items-center">
        <BrandLogo size="sm" />
      </div>

      <div className="ms-auto flex items-center gap-2">
        <HeaderProjectSwitcher allowAll className="min-w-0" />
        <HeaderUserMenu email={email} />
        <HeaderLanguageSwitcher />
      </div>
    </header>
  )
}

function AdminFlatNav({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useControlCenterDetailsOptional()
  const { locale } = useLocale()
  const fa = locale === 'fa'

  const openDetail = ctx?.openDetail ?? null
  const feeds = ctx?.feeds

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

  return (
    <div className={cn(compact ? 'flex flex-wrap gap-1' : 'space-y-1')}>
      <FlatAction
        label={fa ? 'کنترل سنتر' : 'Control Center'}
        icon={LayoutDashboard}
        active={pathname === '/admin' && openDetail === null}
        onClick={goControlCenter}
      />
      <FlatLink
        href="/admin/projects"
        label={fa ? 'پروژه‌ها' : 'Projects'}
        icon={FolderKanban}
        active={linkActive('/admin/projects')}
      />
      <FlatLink
        href="/dashboard/qc"
        label={fa ? 'کنترل کیفیت' : 'Quality Control'}
        icon={ClipboardCheck}
        active={linkActive('/dashboard/qc')}
      />
      <FlatAction
        label={fa ? 'داشبورد اعضا' : 'Member Dashboards'}
        icon={Users}
        count={ctx?.members.length}
        active={openDetail === 'dashboards'}
        onClick={() => selectDetail('dashboards')}
      />
      <MessengerButton variant="nav" />
      <FlatAction
        label={fa ? 'ساپورت و پیام‌ها' : 'Support & Messages'}
        icon={MessageSquare}
        count={feeds?.tickets.length}
        active={openDetail === 'messages'}
        onClick={() => selectDetail('messages')}
      />
      <FlatAction
        label={fa ? 'هشدارهای بحرانی' : 'Critical Alerts'}
        icon={AlertCircle}
        count={feeds?.alerts.length}
        warn={(feeds?.alerts.length ?? 0) > 0}
        active={openDetail === 'alerts'}
        onClick={() => selectDetail('alerts')}
      />
      <FlatLink
        href="/settings"
        label={fa ? 'تنظیمات' : 'Settings'}
        icon={Settings}
        active={linkActive('/settings')}
      />
    </div>
  )
}

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
      {typeof count === 'number' ? (
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
          {count}
        </span>
      ) : null}
    </button>
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
    { href: `${base}/members`, label: 'اعضا' },
    { href: `${base}/positions`, label: 'سمت‌ها' },
    { href: `${base}/schedule`, label: 'برنامه زمان‌بندی' },
    { href: `${base}/routing`, label: 'اعلان‌ها' },
    { href: `${base}/widgets`, label: 'نمایش' },
  ]

  return (
    <div className="rounded-[12px] border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">پروژه</p>
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
