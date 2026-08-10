'use client'

import { useControlCenterDetails } from '@/components/admin/control-center-details-context'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { ActivityFeed } from '@/components/admin/activity-feed'
import { OnlineUsersPanel } from '@/components/admin/online-users-panel'
import { SupportTicketsPanel, CriticalAlertsPanel } from '@/components/admin/support-tickets'
import { RoleDashboardGrid } from '@/components/admin/role-dashboard-grid'
import type { DetailKey } from '@/components/admin/control-center-details-context'
import {
  Users,
  UserCheck,
  MapPin,
  AlertCircle,
  MessageSquare,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { APP_TAGLINE } from '@/lib/brand'
import { useLocale } from '@/components/i18n/locale-provider'

export function AdminDashboard() {
  const { feeds, stats, members, loading, error, openDetail } = useControlCenterDetails()
  const { locale } = useLocale()
  const fa = locale === 'fa'

  if (loading) return <LoadingBlock label={fa ? 'در حال بارگذاری کنترل سنتر...' : 'Loading control center...'} />
  if (error || !stats) return <ErrorBlock message={error ?? (fa ? 'بارگذاری داشبورد ممکن نشد' : 'Unable to load dashboard')} />

  const pendingPassword = members.filter((m) => !m.password_changed_by_member).length
  const activeMembers = members.filter((m) => m.is_active).length
  const needsAttention = pendingPassword + feeds.alerts.length + feeds.openMessageCount

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        title="کنترل سنتر"
        description={`${APP_TAGLINE} نمای کلی سیستم و پایش تیم — بدون شلوغی.`}
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="کل کاربران" value={stats.memberCount} icon={Users} trend={`${stats.projectCount} پروژه`} />
        <StatCard label="کاربران فعال" value={activeMembers} icon={UserCheck} trend="فعال و مجاز" trendType="up" />
        <StatCard
          label="حاضر در سایت"
          value={feeds.insideCount}
          icon={MapPin}
          trend={`${feeds.outsideCount} خارج · ${feeds.absentCount} غایب`}
          trendType={feeds.insideCount > 0 ? 'up' : 'neutral'}
        />
        <StatCard
          label="نیاز به توجه"
          value={needsAttention}
          icon={AlertCircle}
          trend={pendingPassword > 0 ? `${pendingPassword} رمز در انتظار` : 'هشدارها و پیام‌ها'}
          trendType={needsAttention > 0 ? 'warning' : 'up'}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuietMetric
          label="پیام‌ها"
          value={feeds.tickets.length}
          hint={`${feeds.openMessageCount} فوری / باز`}
          icon={MessageSquare}
        />
        <QuietMetric
          label="هشدارهای باز"
          value={feeds.alerts.length}
          hint="بحرانی و موجودی حل‌نشده"
          icon={AlertCircle}
          warn={feeds.alerts.length > 0}
        />
        <QuietMetric
          label="رمز در انتظار"
          value={pendingPassword}
          hint="نیاز به اولین ورود"
          icon={Shield}
          warn={pendingPassword > 0}
        />
      </section>

      <ControlCenterExpandedPanel />

      {!openDetail ? (
        <p className="hidden lg:block text-sm text-muted-foreground text-center py-12">
          {fa
            ? 'از منوی راست یک آیتم را انتخاب کنید تا اینجا باز شود.'
            : 'Select an item from the sidebar to open it here.'}
        </p>
      ) : null}
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
    <section className="rounded-2xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">{titles[openDetail]}</h2>
        {openDetail === 'dashboards' ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {fa
              ? 'داشبورد نقش‌ها (از جمله مسئول ایمنی) و اعضای تعریف‌شده'
              : 'Role dashboards (including HSE) and defined members'}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            {fa ? 'داده زنده — نمای کامل' : 'Live data — full view'}
          </p>
        )}
      </div>
      <div className="p-5 max-h-[min(78vh,720px)] overflow-y-auto">
        {openDetail === 'messages' ? <SupportTicketsPanel tickets={feeds.tickets} /> : null}
        {openDetail === 'alerts' ? <CriticalAlertsPanel alerts={feeds.alerts} /> : null}
        {openDetail === 'roles' && stats.roleBreakdown ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.roleBreakdown.map((item) => (
              <div key={item.role} className="rounded-xl bg-slate-50 px-4 py-4">
                <p className="text-xs text-muted-foreground">{item.role}</p>
                <p className="text-2xl font-semibold tracking-tight mt-1">{item.count}</p>
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

function QuietMetric({
  label,
  value,
  hint,
  icon: Icon,
  warn,
}: {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  warn?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          warn ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{hint}</p>
        </div>
      </div>
    </div>
  )
}
