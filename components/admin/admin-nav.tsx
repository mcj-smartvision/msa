'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Settings,
  HardHat,
  MessageSquare,
  AlertCircle,
  Activity,
  Calendar,
  Globe,
  UserPlus,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME, APP_PRODUCT_LINE } from '@/lib/brand'
import { LogoutButton } from '@/components/auth/logout-button'
import { useLocale } from '@/components/i18n/locale-provider'
import { LOCALE_OPTIONS } from '@/lib/i18n/app-shell'
import type { FormLocale } from '@/lib/project-init/i18n/types'
import { useScheduleCalendar } from '@/hooks/useScheduleCalendar'
import type { ScheduleCalendar } from '@/lib/schedule/calendar-preference'
import { HeaderProjectSwitcher } from '@/components/project/header-project-switcher'
import { MessengerButton } from '@/components/messaging/messenger-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useControlCenterDetailsOptional,
  ControlCenterDataProvider,
  type DetailKey,
} from '@/components/admin/control-center-details-context'

const CALENDAR_OPTIONS: { value: ScheduleCalendar; labelEn: string; labelFa: string }[] = [
  { value: 'gregorian', labelEn: 'Gregorian', labelFa: 'میلادی' },
  { value: 'jalali', labelEn: 'Shamsi (Jalali)', labelFa: 'هجری شمسی' },
]

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
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <aside className="hidden lg:flex w-[260px] flex-col border-e border-slate-200/90 bg-white shrink-0">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shrink-0">
            <HardHat className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[13px] leading-tight tracking-tight">{APP_NAME}</p>
            <p className="text-[10px] text-muted-foreground truncate">{APP_PRODUCT_LINE}</p>
          </div>
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
  const ctx = useControlCenterDetailsOptional()
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const alertCount = ctx?.feeds.alerts.length ?? 0
  const initial = (email ?? 'A').trim().charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200/90 bg-white/95 px-4 sm:px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <HardHat className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">{APP_NAME}</span>
      </div>
      <p className="hidden lg:block text-sm font-semibold tracking-tight text-slate-900">{APP_NAME}</p>

      <div className="ms-auto flex items-center gap-2 sm:gap-3">
        <HeaderProjectSwitcher allowAll className="min-w-0" />
        <button
          type="button"
          onClick={() => ctx?.setOpenDetail('alerts')}
          className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label={fa ? 'اعلان‌ها' : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 ? (
            <span className="absolute -top-1 -start-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          ) : null}
        </button>
        <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white py-1 ps-1 pe-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-slate-900 text-[11px] font-semibold text-white">
            {initial}
          </span>
          <span className="hidden sm:block max-w-[140px] truncate text-xs text-slate-600" title={email}>
            {email ?? (fa ? 'ادمین' : 'Admin')}
          </span>
        </div>
      </div>
    </header>
  )
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      {children}
    </div>
  )
}

function AdminFlatNav({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useControlCenterDetailsOptional()
  const { locale, setLocale } = useLocale()
  const fa = locale === 'fa'
  const { calendar, setCalendar } = useScheduleCalendar()

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

  const linkActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <div className={cn(compact ? 'flex flex-wrap gap-1' : 'space-y-1')}>
      <NavGroup label={fa ? 'نمای کلی' : 'Overview'}>
        <FlatLink
          href="/admin"
          label={fa ? 'کنترل سنتر' : 'Control Center'}
          icon={LayoutDashboard}
          active={linkActive('/admin', true)}
        />
      </NavGroup>

      <NavGroup label={fa ? 'شرکت و پروژه‌ها' : 'Company'}>
        <FlatLink
          href="/admin/projects"
          label={fa ? 'پروژه‌ها' : 'Projects'}
          icon={FolderKanban}
          active={linkActive('/admin/projects')}
        />
      </NavGroup>

      <NavGroup label={fa ? 'تیم' : 'Team'}>
        <FlatAction
          label={fa ? 'داشبورد اعضا' : 'Member Dashboards'}
          icon={Users}
          count={ctx?.members.length}
          active={openDetail === 'dashboards'}
          onClick={() => selectDetail('dashboards')}
        />
        <FlatLink
          href="/admin/members"
          label={fa ? 'اضافه کردن عضو' : 'Add Member'}
          icon={UserPlus}
          active={linkActive('/admin/members')}
        />
      </NavGroup>

      <NavGroup label={fa ? 'پایش' : 'Monitor'}>
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
        <FlatAction
          label={fa ? 'فعالیت‌های اخیر' : 'Recent Activity'}
          icon={Activity}
          count={feeds?.activities.length}
          active={openDetail === 'activity'}
          onClick={() => selectDetail('activity')}
        />
      </NavGroup>

      <NavGroup label={fa ? 'تنظیمات' : 'Settings'}>
        <Select value={calendar} onValueChange={(v) => setCalendar(v as ScheduleCalendar)}>
          <SelectTrigger
            className={cn(NAV_ROW, 'h-auto border-0 shadow-none bg-transparent focus:ring-0')}
            aria-label={fa ? 'نوع تقویم' : 'Calendar'}
          >
            <Calendar className="h-4 w-4 shrink-0 opacity-90" />
            <SelectValue>
              <span className="truncate">
                {fa ? 'تقویم' : 'Calendar'}
                <span className="mx-1.5 text-muted-foreground">·</span>
                {CALENDAR_OPTIONS.find((o) => o.value === calendar)
                  ? fa
                    ? CALENDAR_OPTIONS.find((o) => o.value === calendar)!.labelFa
                    : CALENDAR_OPTIONS.find((o) => o.value === calendar)!.labelEn
                  : calendar}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {fa ? opt.labelFa : opt.labelEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={locale} onValueChange={(v) => setLocale(v as FormLocale)}>
          <SelectTrigger
            className={cn(NAV_ROW, 'h-auto border-0 shadow-none bg-transparent focus:ring-0')}
            aria-label={fa ? 'زبان' : 'Language'}
          >
            <Globe className="h-4 w-4 shrink-0 opacity-90" />
            <SelectValue>
              <span className="truncate">
                {fa ? 'زبان' : 'Language'}
                <span className="mx-1.5 text-muted-foreground">·</span>
                {LOCALE_OPTIONS.find((o) => o.value === locale)?.label ?? locale}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LOCALE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FlatLink
          href="/settings"
          label={fa ? 'تنظیمات' : 'Settings'}
          icon={Settings}
          active={linkActive('/settings')}
        />
      </NavGroup>
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
