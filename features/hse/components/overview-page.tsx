/**
 * @file features/hse/components/overview-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (overview-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/format, features/hse/components/ui, features/hse/lib/mock-data, features/hse/lib/nav, features/hse/lib/types, shared/lib/utils, features/hse/config
 */

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
import { HSE_OVERVIEW_COPY } from '@/features/hse/config'

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
        title={HSE_OVERVIEW_COPY.title}
        description={HSE_OVERVIEW_COPY.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={HSE_OVERVIEW_COPY.kpiActive}
          value={kpis.activeIncidents}
          hint={HSE_OVERVIEW_COPY.totalHint(kpis.totalIncidents)}
          tone={kpis.activeIncidents > 5 ? 'bad' : 'warn'}
          icon={ShieldAlert}
        />
        <KpiCard
          label={HSE_OVERVIEW_COPY.kpiConfirmed}
          value={kpis.confirmedViolations}
          hint={HSE_OVERVIEW_COPY.falsePositiveHint(kpis.falsePositives)}
          tone="bad"
          icon={AlertTriangle}
        />
        <KpiCard
          label={HSE_OVERVIEW_COPY.kpiCameras}
          value={`${kpis.camerasOnline}/${kpis.camerasTotal}`}
          hint={HSE_OVERVIEW_COPY.livePulse}
          tone={kpis.camerasOnline === kpis.camerasTotal ? 'good' : 'warn'}
          icon={Camera}
        />
        <KpiCard
          label={HSE_OVERVIEW_COPY.kpiAckClose}
          value={HSE_OVERVIEW_COPY.ackCloseValue(kpis.avgAckMinutes, kpis.avgCloseHours)}
          hint={HSE_OVERVIEW_COPY.responseHint}
          tone="neutral"
          icon={Clock}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title={HSE_OVERVIEW_COPY.severityTitle} description={HSE_OVERVIEW_COPY.severityDesc} className="lg:col-span-1">
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

        <Panel title={HSE_OVERVIEW_COPY.topZonesTitle} description={HSE_OVERVIEW_COPY.topZonesDesc} className="lg:col-span-1">
          {zones.length === 0 ? (
            <EmptyRow>{HSE_OVERVIEW_COPY.emptyZones}</EmptyRow>
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

        <Panel title={HSE_OVERVIEW_COPY.camerasTitle} description={HSE_OVERVIEW_COPY.camerasDesc} className="lg:col-span-1">
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
        <Panel title={HSE_OVERVIEW_COPY.contractorsTitle} description={HSE_OVERVIEW_COPY.contractorsDesc}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_OVERVIEW_COPY.colContractor}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_OVERVIEW_COPY.colTrade}</th>
                  <th className="pb-2 pl-3 font-semibold tabular-nums">{HSE_OVERVIEW_COPY.colOpen}</th>
                  <th className="pb-2 pl-3 font-semibold tabular-nums">{HSE_OVERVIEW_COPY.colConfirmed}</th>
                  <th className="pb-2 font-semibold tabular-nums">{HSE_OVERVIEW_COPY.colFalsePositive}</th>
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
          title={HSE_OVERVIEW_COPY.recentTitle}
          description={HSE_OVERVIEW_COPY.recentDesc}
          actions={
            <Link
              href={`${HSE_BASE}/incidents`}
              className="text-xs font-medium text-amber-700 hover:underline"
            >
              {HSE_OVERVIEW_COPY.viewAll}
            </Link>
          }
        >
          {critical.length === 0 ? (
            <EmptyRow>{HSE_OVERVIEW_COPY.emptyCritical}</EmptyRow>
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

      <Panel title={HSE_OVERVIEW_COPY.responseTitle} description={HSE_OVERVIEW_COPY.responseDesc}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded border border-slate-200 px-3 py-3">
            <Activity className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                {HSE_OVERVIEW_COPY.avgAck}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                {kpis.avgAckMinutes} {HSE_OVERVIEW_COPY.minutes}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {HSE_OVERVIEW_COPY.avgAckHint}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded border border-slate-200 px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                {HSE_OVERVIEW_COPY.avgClose}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                {kpis.avgCloseHours} {HSE_OVERVIEW_COPY.hours}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {HSE_OVERVIEW_COPY.avgCloseHint}
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
