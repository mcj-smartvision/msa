'use client'

import Link from 'next/link'
import {
Activity,
AlertTriangle,
Camera,
CheckCircle2,
Clock,
ShieldAlert,
} from 'lucide-react'
import { SeverityBadge, StatusBadge, HealthBadge } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, KpiCard, Panel } from '@/features/hse/components/ui'
import {
cameraHealthSummary,
contractorComparison,
getOverviewKpis,
recentCritical,
severityBreakdown,
topRiskZones,
} from '@/features/hse/lib/mock-data'
import { HSE_BASE } from '@/features/hse/lib/nav'
import type { Severity } from '@/features/hse/lib/types'
import { cn } from '@/shared/lib/utils'

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']

const severityBarClass: Record<Severity, string> = {
  critical: 'bg-rose-600',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
}

export function OverviewPage() {
  const kpis = getOverviewKpis()
  const severity = severityBreakdown()
  const severityTotal = SEVERITY_ORDER.reduce((sum, s) => sum + severity[s], 0) || 1
  const zones = topRiskZones()
  const contractors = contractorComparison()
  const critical = recentCritical(8)
  const camHealth = cameraHealthSummary()

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="نمای کلی ایمنی"
        description="تصویر عملیاتی از حوادث تشخیص‌داده‌شده با دوربین، ریسک زون‌ها، مواجهه پیمانکاران و عملکرد پاسخ."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="حوادث فعال"
          value={kpis.activeIncidents}
          hint={`${kpis.totalIncidents} مورد در مجموعه داده`}
          tone={kpis.activeIncidents > 5 ? 'bad' : 'warn'}
          icon={ShieldAlert}
        />
        <KpiCard
          label="تخلفات تأییدشده"
          value={kpis.confirmedViolations}
          hint={`${kpis.falsePositives} مثبت کاذب`}
          tone="bad"
          icon={AlertTriangle}
        />
        <KpiCard
          label="دوربین‌های آنلاین"
          value={`${kpis.camerasOnline}/${kpis.camerasTotal}`}
          hint="ضربان زنده"
          tone={kpis.camerasOnline === kpis.camerasTotal ? 'good' : 'warn'}
          icon={Camera}
        />
        <KpiCard
          label="میانگین دریافت / بستن"
          value={`${kpis.avgAckMinutes}د / ${kpis.avgCloseHours}س`}
          hint="شاخص پاسخ"
          tone="neutral"
          icon={Clock}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="تفکیک شدت" description="همه حوادث بر اساس شدت" className="lg:col-span-1">
          <ul className="space-y-2.5">
            {SEVERITY_ORDER.map((s) => {
              const count = severity[s]
              const pct = Math.round((count / severityTotal) * 100)
              return (
                <li key={s}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <SeverityBadge value={s} />
                    <span className="tabular-nums text-slate-600">
                      {count} ({pct}٪)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-slate-100">
                    <div
                      className={cn('h-full rounded', severityBarClass[s])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="زون‌های پرریسک" description="بیشترین تعداد حادثه" className="lg:col-span-1">
          {zones.length === 0 ? (
            <EmptyRow>فعالیتی در زون ثبت نشده است.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {zones.map((z, idx) => (
                <li key={z.zoneId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="ml-2 tabular-nums text-xs text-slate-400">{idx + 1}.</span>
                    <span className="font-medium text-slate-800">{z.name}</span>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                    {z.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="سلامت دوربین‌ها" description="خلاصه وضعیت ناوگان" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['online', camHealth.online],
                ['degraded', camHealth.degraded],
                ['offline', camHealth.offline],
                ['calibrating', camHealth.calibrating],
              ] as const
            ).map(([health, count]) => (
              <div
                key={health}
                className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-2"
              >
                <HealthBadge value={health} />
                <span className="text-lg font-semibold tabular-nums text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="مقایسه پیمانکاران" description="موارد باز در برابر تخلفات تأییدشده">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">پیمانکار</th>
                  <th className="pb-2 pl-3 font-semibold">رشته</th>
                  <th className="pb-2 pl-3 font-semibold tabular-nums">باز</th>
                  <th className="pb-2 pl-3 font-semibold tabular-nums">تأییدشده</th>
                  <th className="pb-2 font-semibold tabular-nums">مثبت کاذب</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pl-3 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2 pl-3 text-slate-600">{c.trade}</td>
                    <td className="py-2 pl-3 tabular-nums text-slate-800">{c.openIncidents}</td>
                    <td className="py-2 pl-3 tabular-nums text-rose-700">{c.confirmedViolations}</td>
                    <td className="py-2 tabular-nums text-slate-600">{c.falsePositives}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="بحرانی / بالای اخیر"
          description="جدیدترین تشخیص‌های شدت بالا"
          actions={
            <Link
              href={`${HSE_BASE}/incidents`}
              className="text-xs font-medium text-amber-700 hover:underline"
            >
              مشاهده همه
            </Link>
          }
        >
          {critical.length === 0 ? (
            <EmptyRow>حادثه بحرانی یا بالایی نیست.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {critical.map((inc) => (
                <li key={inc.id}>
                  <Link
                    href={`${HSE_BASE}/incidents/${inc.id}`}
                    className="flex flex-col gap-1 py-2.5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500">{inc.code}</span>
                        <SeverityBadge value={inc.severity} />
                        <StatusBadge value={inc.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{inc.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                      {formatDateTime(inc.detectedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="عملکرد پاسخ" description="زمان دریافت و بستن چرخه">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded border border-slate-200 px-3 py-3">
            <Activity className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                میانگین دریافت
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                {kpis.avgAckMinutes} دقیقه
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                زمان از تشخیص تا اولین دریافت انسانی.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded border border-slate-200 px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                میانگین بستن
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                {kpis.avgCloseHours} ساعت
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                زمان از تشخیص تا وضعیت بسته‌شده (شامل پیگیری اصلاحی).
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
