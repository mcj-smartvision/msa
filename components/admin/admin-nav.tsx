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
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900'

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
    <div className="flex min-h-screen bg-[#f4f5f7]">
      <aside className="hidden lg:flex w-[280px] flex-col border-e border-slate-200/80 bg-white shrink-0">
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[15px] leading-tight tracking-tight">{APP_NAME}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{APP_PRODUCT_LINE}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3 pt-4 overflow-y-auto">
          <AdminFlatNav />
        </nav>

        <div className="border-t border-slate-100 p-4 space-y-3">
          {email ? (
            <p className="text-xs text-muted-foreground truncate px-1" title={email}>
              {email}
            </p>
          ) : null}
          <LogoutButton label="خروج" className="w-full" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white/95 backdrop-blur px-4">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            <span className="font-bold">{APP_NAME}</span>
          </div>
          <LogoutButton label="خروج" />
        </header>

        <div className="lg:hidden border-b bg-white px-2 py-2 overflow-x-auto">
          <nav className="min-w-[280px]">
            <AdminFlatNav compact />
          </nav>
        </div>

        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

/** One flat list — every item same level, same row style. */
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
    <div className={cn('space-y-0.5', compact && 'space-y-1')}>
      {/* Project switcher — same row width */}
      <div className="px-1 pb-1">
        <HeaderProjectSwitcher className="[&_button]:w-full [&_button]:justify-between [&_button]:h-10 [&_button]:rounded-xl" />
      </div>

      {/* Messenger — same row level as everything else */}
      <MessengerButton variant="nav" />

      {/* Calendar */}
      <Select value={calendar} onValueChange={(v) => setCalendar(v as ScheduleCalendar)}>
        <SelectTrigger
          className={cn(NAV_ROW, 'h-auto border-0 shadow-none bg-transparent focus:ring-0')}
          aria-label={fa ? 'نوع تقویم' : 'Calendar'}
        >
          <Calendar className="h-4 w-4 shrink-0 opacity-90" />
          <SelectValue>
            <span className="truncate">
              {fa ? 'نوع تقویم' : 'Calendar'}
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

      {/* Language */}
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
        href="/admin"
        label={fa ? 'کنترل سنتر' : 'Control Center'}
        icon={LayoutDashboard}
        active={linkActive('/admin', true)}
      />
      <FlatLink
        href="/admin/projects"
        label={fa ? 'پروژه‌ها' : 'Projects'}
        icon={FolderKanban}
        active={linkActive('/admin/projects')}
      />
      <FlatLink
        href="/settings"
        label={fa ? 'تنظیمات' : 'Settings'}
        icon={Settings}
        active={linkActive('/settings')}
      />

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
      <FlatAction
        label={fa ? 'فعالیت‌های اخیر' : 'Recent Activity'}
        icon={Activity}
        count={feeds?.activities.length}
        active={openDetail === 'activity'}
        onClick={() => selectDetail('activity')}
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
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">پروژه</p>
        <h2 className="text-lg font-semibold mt-1">{projectName}</h2>
      </div>
      <nav className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
