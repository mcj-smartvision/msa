'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
  ArrowRight,
  Bell,
  Calculator,
  CalendarRange,
  ChevronDown,
  CircleHelp,
  Compass,
  FileSignature,
  FileText,
  HardHat,
  Inbox,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Menu,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/admin/shared'
import { BrandLogo } from '@/components/brand/brand-logo'
import { HeaderUserMenu } from '@/components/account/header-user-menu'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import type { ManagerNavGroup, ManagerNavIcon, ManagerNavModel } from '@/lib/manager/manager-nav'
import type { ManagerAlert, ManagerAlertDomain, ManagerOverview, ManagerPeriod } from '@/lib/manager/overview-types'
import { MANAGER_PERIODS } from '@/lib/manager/alert-period'
import { faNumber, jalaliDate, jalaliDateTime, relativeTimeFa } from '@/lib/manager/format'
import { SectionBody, SectionCard, Spinner } from './manager-ui'
import {
  AlertCard,
  DOMAIN_META,
  DecisionsSection,
  HealthBar,
  KpiStrip,
  ResourcesFinanceSection,
  SitePulseSection,
  SmartAlertsSection,
  StatusTag,
  buildHealthPillars,
  domainHref,
  overallStatus,
  type ManagerHrefs,
} from './manager-sections'
import { ManagerProgressChart } from './manager-progress-chart'
import { CostPerformanceSection } from './cost-performance-section'
import { ManagerPeriodCompare } from './manager-period-compare'
import { ManagerBackgroundView } from './manager-background'
import { PmInboxCard } from './pm-inbox-card'
import { BlockersDelaysCard, DailyDeltaCard } from './manager-daily-section'
import { ManagerHelpPanel, type ManagerHelpLink } from './manager-help-panel'
import { ManagerTour, markTourSeen, readTourSeen, type ManagerTourStep } from './manager-tour'
import { managerFont } from './manager-font'

const REFRESH_MS = 5 * 60 * 1000

const NAV_ICONS: Record<ManagerNavIcon, ComponentType<{ className?: string }>> = {
  home: LayoutDashboard,
  alerts: ShieldAlert,
  inbox: Inbox,
  schedule: CalendarRange,
  site: HardHat,
  quality: ShieldCheck,
  finance: Wallet,
  contracts: FileSignature,
  reports: FileText,
  background: Calculator,
}

const TOUR_STEPS: ManagerTourStep[] = [
  {
    target: 'health',
    title: 'نوار سلامت پروژه',
    body: 'پنج ستون اصلی پروژه — زمان‌بندی، هزینه، ایمنی، کیفیت و مصالح — در یک نگاه. وضعیت کلی سربرگ از بدترین ستون گرفته می‌شود.',
  },
  {
    target: 'kpis',
    title: 'چهار شاخص اصلی',
    body: 'پیشرفت تجمعی در برابر برنامه، انحراف زمانی (روز و SPI)، انحراف هزینه (BAC، EV، AC و CPI) و اقدامات معوق.',
  },
  {
    target: 'pulse',
    title: 'نبض زندهٔ کارگاه',
    body: 'آخرین ثبت گزارش روزانه، انبار، ایمنی و گیت. اگر بخشی عقب مانده باشد، با «ارسال یادآوری» به مسئولش اعلان بفرستید.',
  },
  {
    target: 'alerts',
    title: 'هشدارهای هوشمند',
    body: 'فقط سه هشدار مهم، با حوزه، اثر احتمالی و پیشنهاد سیستم. نوار قرمز یعنی بحران و کهربایی یعنی نیازمند توجه؛ فهرست کامل از پایین همین کارت باز می‌شود.',
  },
  {
    target: 'chart',
    title: 'منحنی S پیشرفت',
    body: 'خط برنامه (PV)، پیشرفت واقعی تأییدشده و ارزش کسب‌شده (EV) از چپ به راست در طول زمان. نقطهٔ «امروز» همان مقادیر کارت‌های بالای صفحه است.',
  },
]

const PERIOD_IDS = MANAGER_PERIODS.map((p) => p.id)

/** Header period, kept in `?period=` so a refresh or a shared link keeps it. */
function parsePeriod(raw: string | null): ManagerPeriod {
  return raw && PERIOD_IDS.includes(raw as ManagerPeriod) ? (raw as ManagerPeriod) : 'week'
}

/**
 * Header period, kept in `?period=` so a refresh or a shared link keeps it. The URL is updated with
 * `history.replaceState` so switching never waits for a server re-render of the page.
 */
function usePeriodParam(): [ManagerPeriod, (next: ManagerPeriod) => void] {
  const searchParams = useSearchParams()
  const urlPeriod = parsePeriod(searchParams.get('period'))
  const [period, setPeriodState] = useState<ManagerPeriod>(urlPeriod)

  useEffect(() => {
    setPeriodState(urlPeriod)
  }, [urlPeriod])

  const setPeriod = useCallback((next: ManagerPeriod) => {
    setPeriodState(next)
    const url = new URL(window.location.href)
    url.searchParams.set('period', next)
    window.history.replaceState(window.history.state, '', url)
  }, [])
  return [period, setPeriod]
}

function useManagerOverview(projectId: string | null) {
  const [data, setData] = useState<ManagerOverview | null>(null)
  const [loading, setLoading] = useState(Boolean(projectId))
  const [error, setError] = useState<string | null>(null)
  const loadedAt = useRef(0)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!projectId) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/manager/overview?projectId=${encodeURIComponent(projectId)}`, {
        cache: 'no-store',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'بارگذاری داشبورد ناموفق بود')
      if (id !== requestId.current) return
      setData(body as ManagerOverview)
      loadedAt.current = Date.now()
    } catch (loadError) {
      if (id !== requestId.current) return
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری داشبورد ناموفق بود')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 60000) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { data, loading, error, reload: load }
}

/* ------------------------------------------------------------------ Sidebar */

function withProject(href: string, projectId: string | null, enabled?: boolean) {
  return enabled && projectId ? `${href}?projectId=${encodeURIComponent(projectId)}` : href
}

function SidebarGroup({
  group,
  projectId,
  pathname,
  onNavigate,
}: {
  group: ManagerNavGroup
  projectId: string | null
  pathname: string
  onNavigate?: () => void
}) {
  const Icon = NAV_ICONS[group.icon]
  const childActive = group.children?.some((c) => pathname.startsWith(c.href)) ?? false
  const [open, setOpen] = useState(true)
  const itemClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
      active
        ? 'bg-orange-50 font-semibold text-primary shadow-[inset_-3px_0_0_hsl(var(--primary))]'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    )

  if (group.href) {
    const active = pathname === group.href
    return (
      <li>
        <Link
          href={withProject(group.href, projectId, group.withProjectParam)}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={itemClass(active)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {group.label}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={itemClass(childActive)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-right">{group.label}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="mr-5 mt-0.5 space-y-0.5 border-r border-slate-200 pr-2">
          {group.children?.map((child) => {
            const active = pathname.startsWith(child.href)
            return (
              <li key={child.href}>
                <Link
                  href={withProject(child.href, projectId, child.withProjectParam)}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    active ? 'font-semibold text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

function SidebarContent({
  nav,
  projectId,
  isAdmin,
  onNavigate,
  onOpenHelp,
}: {
  nav: ManagerNavModel
  projectId: string | null
  isAdmin: boolean
  onNavigate?: () => void
  onOpenHelp: () => void
}) {
  const pathname = usePathname()
  const footerLink =
    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
  return (
    <div className="flex h-full flex-col">
      <nav aria-label="منوی ماژول‌ها" data-tour="nav" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          {nav.groups.map((group) => (
            <SidebarGroup key={group.key} group={group} projectId={projectId} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
      <div className="space-y-0.5 border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={onOpenHelp}
          aria-haspopup="dialog"
          className="group mb-2 flex w-full items-center gap-3 rounded-2xl border border-orange-200/60 bg-gradient-to-l from-orange-50 via-orange-50/50 to-white p-3 text-right shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-orange-300/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:hover:translate-y-0"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-primary text-white shadow-sm transition-transform duration-300 group-hover:rotate-12 motion-reduce:group-hover:rotate-0">
            <Compass className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-slate-800">راهنما و تور سیستم</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary">تعاملی</span>
            </span>
            <span className="block truncate text-[11px] text-slate-500">تور ۵ مرحله‌ای، اصطلاحات و میانبرها</span>
          </span>
        </button>
        {isAdmin ? (
          <Link href="/admin" onClick={onNavigate} className={footerLink}>
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            کنترل سنتر
          </Link>
        ) : null}
        <Link href="/settings" onClick={onNavigate} className={footerLink}>
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          تنظیمات
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Notifications */

function NotificationsMenu({
  overview,
  critical,
  inboxHref,
}: {
  overview: ManagerOverview | null
  critical: ManagerAlert[]
  inboxHref: ((id?: string) => string) | null
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const decisions = overview?.decisions.status === 'ok' ? overview.decisions.data : null
  const count = (decisions?.total ?? 0) + critical.length

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={count > 0 ? `اعلان‌ها، ${faNumber(count)} مورد` : 'اعلان‌ها'}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {count > 0 ? (
          <span className="absolute -left-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {count > 99 ? '۹۹+' : faNumber(count)}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-900">اعلان‌ها</p>
          {count === 0 ? (
            <p className="px-4 py-5 text-center text-xs text-slate-500">اعلان تازه‌ای نیست.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {decisions?.items.slice(0, 3).map((item) => (
                <li key={item.id}>
                  {inboxHref ? (
                    <Link
                      href={inboxHref(item.id)}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      <span className="block text-[11px] font-semibold text-primary">
                        {item.kind === 'change_request' ? 'درخواست تغییر' : 'منتظر تأیید شما'}
                      </span>
                      <span className="block truncate text-xs text-slate-800">{item.title}</span>
                    </Link>
                  ) : (
                    <span className="block px-4 py-2.5 text-xs text-slate-800">{item.title}</span>
                  )}
                </li>
              ))}
              {critical.slice(0, 3).map((alert) => (
                <li key={alert.id}>
                  <Link
                    href="/dashboard/manager/alerts"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <span className="block text-[11px] font-semibold text-rose-700">هشدار بحرانی · {DOMAIN_META[alert.domain].label}</span>
                    <span className="block truncate text-xs text-slate-800">{alert.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------- Alerts view */

function AllAlertsView({
  overview,
  loading,
  period,
  hrefs,
}: {
  overview: ManagerOverview | null
  loading: boolean
  period: ManagerPeriod
  hrefs: ManagerHrefs
}) {
  const [level, setLevel] = useState<'all' | 'critical' | 'warning'>('all')
  const [domain, setDomain] = useState<ManagerAlertDomain | 'all'>('all')

  const chip = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
      active ? 'bg-slate-900 font-semibold text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/manager"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
          بازگشت به داشبورد
        </Link>
      </div>
      <SectionCard title="همهٔ هشدارهای فعال" icon={<ShieldAlert className="h-4 w-4" aria-hidden />}>
        <SectionBody result={overview?.alerts} loading={loading} rows={5}>
          {(alerts) => {
            const domains = Array.from(new Set(alerts.map((a) => a.domain)))
            const shown = alerts.filter(
              (a) => (level === 'all' || a.level === level) && (domain === 'all' || a.domain === domain)
            )
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="فیلتر هشدارها">
                  <button type="button" aria-pressed={level === 'all'} onClick={() => setLevel('all')} className={chip(level === 'all')}>
                    همه ({faNumber(alerts.length)})
                  </button>
                  <button type="button" aria-pressed={level === 'critical'} onClick={() => setLevel('critical')} className={chip(level === 'critical')}>
                    بحرانی ({faNumber(alerts.filter((a) => a.level === 'critical').length)})
                  </button>
                  <button type="button" aria-pressed={level === 'warning'} onClick={() => setLevel('warning')} className={chip(level === 'warning')}>
                    ریسک متوسط ({faNumber(alerts.filter((a) => a.level === 'warning').length)})
                  </button>
                  <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                  <button type="button" aria-pressed={domain === 'all'} onClick={() => setDomain('all')} className={chip(domain === 'all')}>
                    همهٔ حوزه‌ها
                  </button>
                  {domains.map((d) => (
                    <button key={d} type="button" aria-pressed={domain === d} onClick={() => setDomain(d)} className={chip(domain === d)}>
                      {DOMAIN_META[d].label}
                    </button>
                  ))}
                </div>
                {shown.length === 0 ? (
                  <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">هشداری با این فیلتر وجود ندارد.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {shown.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} period={period} href={domainHref(alert.domain, hrefs)} expanded />
                    ))}
                  </div>
                )}
              </div>
            )
          }}
        </SectionBody>
      </SectionCard>
    </div>
  )
}

/* --------------------------------------------------------------- Dashboard */

interface ManagerDashboardProps {
  user: { id: string; name: string; email: string; roleLabel: string; isAdmin: boolean }
  nav: ManagerNavModel
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  view: 'home' | 'alerts' | 'background'
}

export function ManagerDashboard({ user, nav, projectOptions, initialProjectId, view }: ManagerDashboardProps) {
  const projectId = useSyncedProjectId(initialProjectId)
  const { data, loading, error, reload } = useManagerOverview(projectId)
  const [period, setPeriod] = usePeriodParam()
  const [periodReportOpen, setPeriodReportOpen] = useState(false)
  const closePeriodReport = useCallback(() => setPeriodReportOpen(false), [])
  const [helpOpen, setHelpOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    setShowIntro(!readTourSeen(user.id))
  }, [user.id])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  const hrefs = useMemo<ManagerHrefs>(() => {
    const all = new Set<string>()
    for (const group of nav.groups) {
      if (group.href) all.add(group.href)
      for (const child of group.children ?? []) all.add(child.href)
    }
    const pick = (href: string) => (all.has(href) ? href : undefined)
    const inbox =
      all.has('/site-ops/approvals') && projectId
        ? (focusId?: string) => {
            const params = new URLSearchParams({ projectId })
            if (focusId) params.set('focus', focusId)
            return `/site-ops/approvals?${params.toString()}`
          }
        : null
    return {
      evm: pick('/dashboard/project-manager'),
      scheduleIntel: pick('/dashboard/schedule-intelligence'),
      attendance: pick('/dashboard/security'),
      inventory: pick('/dashboard/storekeeper'),
      quality: pick('/dashboard/qc'),
      hse: pick('/dashboard/hse'),
      finance: pick('/finance/costs'),
      invoices: pick('/dashboard/accountant'),
      gantt: pick('/dashboard/technical-office') ?? pick('/dashboard/schedule-intelligence'),
      procurement: pick('/dashboard/procurement'),
      inbox,
    }
  }, [nav, projectId])

  const helpLinks = useMemo<ManagerHelpLink[]>(() => {
    const candidates: (ManagerHelpLink | null)[] = [
      { label: 'همهٔ هشدارها', description: 'فهرست کامل هشدارها با فیلتر حوزه و سطح', href: '/dashboard/manager/alerts' },
      { label: 'بک‌گراند محاسبات', description: 'فرمول و ریز محاسبهٔ هر عدد داشبورد', href: '/dashboard/manager/background' },
      hrefs.inbox ? { label: 'کارتابل من', description: 'تصمیم‌ها و تأییدهای در انتظار', href: hrefs.inbox() } : null,
      hrefs.evm ? { label: 'شاخص‌های ارزش کسب‌شده', description: 'جزئیات SPI، CPI و فعالیت‌ها', href: hrefs.evm } : null,
      hrefs.scheduleIntel
        ? { label: 'تحلیل زمان‌بندی و مسیر بحرانی', description: 'فعالیت‌های بحرانی و شناوری', href: hrefs.scheduleIntel }
        : null,
      hrefs.attendance ? { label: 'منابع انسانی و تردد', description: 'حضور و تردد امروز کارگاه', href: hrefs.attendance } : null,
      hrefs.inventory ? { label: 'انبار و مصالح', description: 'موجودی و اقلام زیر حداقل', href: hrefs.inventory } : null,
      hrefs.invoices ? { label: 'صورت‌وضعیت‌های کارفرما', description: 'ارسال‌شده، در انتظار و پرداخت‌شده', href: hrefs.invoices } : null,
    ]
    return candidates.filter((c): c is ManagerHelpLink => c != null)
  }, [hrefs])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      setHelpOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const alerts = useMemo(() => (data?.alerts.status === 'ok' ? data.alerts.data : []), [data])
  const criticalAlerts = useMemo(() => alerts.filter((a) => a.level === 'critical'), [alerts])
  const pillars = useMemo(() => buildHealthPillars(data, hrefs), [data, hrefs])
  const overall = overallStatus(pillars)

  const closeTour = useCallback(
    (completed: boolean) => {
      setTourOpen(false)
      setShowIntro(false)
      markTourSeen(user.id, completed ? 'done' : 'dismissed')
    },
    [user.id]
  )

  const startTour = useCallback(() => {
    if (view !== 'home') {
      window.location.assign('/dashboard/manager?tour=1')
      return
    }
    setHelpOpen(false)
    setMobileNavOpen(false)
    setShowIntro(false)
    window.scrollTo({ top: 0 })
    setTourOpen(true)
  }, [view])

  useEffect(() => {
    if (view !== 'home' || !new URLSearchParams(window.location.search).has('tour')) return
    window.history.replaceState(null, '', '/dashboard/manager')
    setShowIntro(false)
    setTourOpen(true)
  }, [view])

  if (projectOptions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="داشبورد مدیر"
          description="هنوز پروژه‌ای به شما تخصیص داده نشده است. از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند."
        />
      </div>
    )
  }

  const activeProjectName = data?.project?.name ?? projectOptions.find((p) => p.id === projectId)?.name ?? ''

  return (
    <div
      dir="rtl"
      lang="fa"
      style={{ '--font-sans': managerFont.style.fontFamily } as CSSProperties}
      className={cn(
        managerFont.variable,
        'flex min-h-screen bg-slate-50 font-sans text-right text-slate-900 antialiased [font-feature-settings:normal]'
      )}
    >
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
        <Link
          href="/dashboard/manager"
          className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
        >
          <BrandLogo size="sm" withName />
          <span className="sr-only">داشبورد مدیر پروژه</span>
        </Link>
        <SidebarContent nav={nav} projectId={projectId} isAdmin={user.isAdmin} onOpenHelp={() => setHelpOpen(true)} />
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <div aria-hidden onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-slate-900/40" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="منوی ماژول‌ها"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200 motion-reduce:animate-none"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
              <BrandLogo size="sm" withName />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="بستن منو"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarContent
              nav={nav}
              projectId={projectId}
              isAdmin={user.isAdmin}
              onNavigate={() => setMobileNavOpen(false)}
              onOpenHelp={() => {
                setMobileNavOpen(false)
                setHelpOpen(true)
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {/* The only header on this page */}
        <header className="sticky top-0 z-40 border-b border-sky-200 bg-[#e8f1fb]/95 shadow-xs backdrop-blur-md supports-[backdrop-filter]:bg-[#e8f1fb]/85">
          <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="باز کردن منوی ماژول‌ها"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>

            <div className={cn('relative min-w-0', view === 'home' && 'max-w-full shrink-0')}>
              <select
                value={projectId ?? ''}
                onChange={(event) => {
                  if (event.target.value) writeProjectCookie(event.target.value)
                }}
                aria-label="انتخاب پروژه"
                className={cn(
                  'h-10 appearance-none truncate rounded-xl border border-slate-200/80 bg-white py-0 pe-9 ps-3.5 text-[15px] font-bold tracking-tight text-slate-900 shadow-xs transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  view === 'home' ? 'w-72 max-w-[70vw]' : 'max-w-[240px]'
                )}
              >
                {!projectId ? <option value="">انتخاب پروژه…</option> : null}
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {view === 'home' ? `اتاق فرمان ${p.name}` : p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>

            {view === 'home' ? (
              <button
                type="button"
                onClick={startTour}
                title="یک تور کوتاه ۵ مرحله‌ای از بخش‌های اصلی"
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1',
                  showIntro && !tourOpen && 'ring-2 ring-primary/30 ring-offset-1'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                شروع تور
              </button>
            ) : null}

            {data ? (
              <StatusTag tone={overall.tone} label={overall.label} className="px-2.5 py-1 text-xs" />
            ) : (
              <span className="h-6 w-20 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" aria-hidden />
            )}

            <div role="radiogroup" aria-label="بازهٔ زمانی" className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              {MANAGER_PERIODS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={period === option.id}
                  onClick={() => {
                    setPeriod(option.id)
                    if (view === 'home') setPeriodReportOpen(true)
                  }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    period === option.id
                      ? 'bg-white font-semibold text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                      : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="ms-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => void reload()}
                disabled={loading || !projectId}
                title={data ? `آخرین همگام‌سازی: ${jalaliDateTime(data.generatedAt)}` : undefined}
                aria-label="همگام‌سازی داده‌ها"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {loading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                <span className="hidden md:inline">
                  {data ? `همگام‌سازی ${relativeTimeFa(data.generatedAt)}` : loading ? 'در حال بارگذاری…' : 'همگام‌سازی'}
                </span>
              </button>

              <NotificationsMenu overview={data} critical={criticalAlerts} inboxHref={hrefs.inbox} />

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="مرکز راهنما"
                title="راهنما"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
              </button>

              <HeaderUserMenu email={user.email} className="ms-1" />
            </div>
          </div>
          {view === 'home' ? <HealthBar pillars={pillars} loading={loading && !data} /> : null}
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 px-3 py-6 sm:px-5 lg:px-7 lg:py-7">
          {error ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-rose-100"
              >
                تلاش دوباره
              </button>
            </div>
          ) : null}

          {view === 'alerts' ? (
            <AllAlertsView overview={data} loading={loading} period={period} hrefs={hrefs} />
          ) : view === 'background' ? (
            <ManagerBackgroundView projectId={projectId} overview={data} loading={loading} />
          ) : (
            <>
              <h1 className="sr-only">اتاق فرمان {activeProjectName}</h1>
              {data ? (
                <p className="-mb-2 text-xs text-slate-500">
                  {data.project?.endDate ? `پایان قراردادی ${jalaliDate(data.project.endDate)} · ` : ''}
                  امروز {jalaliDate(data.site.date)}
                </p>
              ) : null}

              {/* Mobile order: decisions, alerts, pulse first; desktop follows the grid. */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
                <div data-tour="kpis" className="order-4 lg:order-1 lg:col-span-12">
                  <KpiStrip
                    overview={data}
                    loading={loading}
                    hrefs={hrefs}
                    inbox={<PmInboxCard projectId={projectId} overview={data} hrefs={hrefs} />}
                  />
                </div>

                <ManagerPeriodCompare
                  projectId={projectId}
                  period={period}
                  refreshKey={data?.generatedAt ?? null}
                  reportOpen={periodReportOpen}
                  onReportClose={closePeriodReport}
                  showSection={false}
                />

                <SectionCard
                  tourId="chart"
                  className="order-5 lg:order-1 lg:col-span-12"
                  title="منحنی S پیشرفت پروژه"
                  icon={<LineChartIcon className="h-4 w-4" aria-hidden />}
                  hint="خط برنامه (PV)، پیشرفت واقعی ثبت‌شده و ارزش کسب‌شده (EV) به درصد تجمعی، از اولین گزارش ثبت‌شدهٔ پیشرفت تا امروز. نقطهٔ «امروز» دقیقاً همان مقادیر کارت‌های بالای صفحه است."
                >
                  <SectionBody result={data?.progress} loading={loading} rows={5}>
                    {(curve) => <ManagerProgressChart curve={curve} />}
                  </SectionBody>
                </SectionCard>

                <CostPerformanceSection
                  className="order-5 lg:order-1 lg:col-span-12"
                  result={data?.evm}
                  loading={loading}
                  costHref={hrefs.finance ?? hrefs.evm}
                />

                <div className="order-5 grid grid-cols-1 gap-5 lg:order-2 lg:col-span-12 lg:grid-cols-12 lg:gap-6">
                  <DailyDeltaCard
                    className="lg:col-span-4"
                    result={data?.daily}
                    loading={loading}
                    today={data?.site.date ?? null}
                  />
                  <BlockersDelaysCard
                    className="lg:col-span-8"
                    blockers={data?.blockers}
                    delays={data?.delays}
                    loading={loading}
                    ganttHref={hrefs.gantt}
                  />
                </div>

                {/* `contents` on mobile lets both cards take their own grid order; stacked on desktop. */}
                <div className="contents lg:order-3 lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
                  <DecisionsSection
                    className="order-1"
                    result={data?.decisions}
                    loading={loading}
                    inboxHref={hrefs.inbox}
                    onChanged={() => void reload()}
                  />
                  <SitePulseSection
                    className="order-3"
                    result={data?.pulse}
                    loading={loading}
                    projectId={projectId}
                    onReminded={() => void reload()}
                  />
                </div>

                <SmartAlertsSection
                  className="order-2 lg:order-4 lg:col-span-7"
                  result={data?.alerts}
                  loading={loading}
                  period={period}
                  hrefs={hrefs}
                />

                <ResourcesFinanceSection
                  className="order-7 lg:order-6 lg:col-span-12"
                  resources={data?.resources}
                  invoices={data?.invoices}
                  loading={loading}
                  hrefs={hrefs}
                />
              </div>
            </>
          )}
        </main>
      </div>

      <ManagerHelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={startTour}
        steps={TOUR_STEPS}
        links={helpLinks}
        unavailable={nav.unavailable}
      />
      <ManagerTour open={tourOpen} steps={TOUR_STEPS} onClose={closeTour} />
    </div>
  )
}
