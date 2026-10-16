/**
 * @file features/hse/components/reports-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (reports-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/format, features/hse/components/ui, shared/components/ui/button, shared/components/ui/select, features/hse/lib/mock-data, shared/lib/utils, features/hse/config
 */

'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { SeverityBadge, StatusBadge } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, KpiCard, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { getCamera, getZone, HSE_INCIDENTS } from '@/features/hse/lib/mock-data'
import { cn } from '@/shared/lib/utils'
import { HSE_COMMON_COPY, HSE_REPORTS_COPY } from '@/features/hse/config'

type Period = 'today' | '7d' | '30d'

/** Demo anchor matches mock-data T() base: 2026-08-09T12:00:00Z */
const ANCHOR = Date.UTC(2026, 7, 9, 12, 0, 0)

function periodStartMs(period: Period): number {
  if (period === 'today') return ANCHOR - 12 * 60 * 60 * 1000
  if (period === '7d') return ANCHOR - 7 * 24 * 60 * 60 * 1000
  return ANCHOR - 30 * 24 * 60 * 60 * 1000
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('7d')

  const filtered = useMemo(() => {
    const start = periodStartMs(period)
    return [...HSE_INCIDENTS]
      .filter((i) => +new Date(i.detectedAt) >= start)
      .sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt))
  }, [period])

  const confirmed = filtered.filter(
    (i) =>
      (i.status === 'confirmed' || i.status === 'closed' || i.status === 'escalated') &&
      !i.falsePositive
  ).length
  const falsePositives = filtered.filter((i) => i.falsePositive).length
  const critical = filtered.filter((i) => i.severity === 'critical').length

  function exportCsv() {
    const header = [...HSE_REPORTS_COPY.csvHeaders]
    const lines = [
      header.join(','),
      ...filtered.map((i) =>
        [
          i.code,
          i.title,
          i.severity,
          i.status,
          getZone(i.zoneId)?.name ?? i.zoneId,
          getCamera(i.cameraId)?.code ?? i.cameraId,
          String(Math.round(i.confidence * 100)),
          i.detectedAt,
          i.falsePositive ? HSE_COMMON_COPY.yes : HSE_COMMON_COPY.no,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hse-incidents-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={HSE_REPORTS_COPY.title}
        description={HSE_REPORTS_COPY.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{HSE_REPORTS_COPY.today}</SelectItem>
                <SelectItem value="7d">{HSE_REPORTS_COPY.last7}</SelectItem>
                <SelectItem value="30d">{HSE_REPORTS_COPY.last30}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" />
              {HSE_REPORTS_COPY.exportTable}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={HSE_REPORTS_COPY.kpiIncidents} value={filtered.length} tone="neutral" />
        <KpiCard label={HSE_REPORTS_COPY.kpiCritical} value={critical} tone={critical > 0 ? 'bad' : 'good'} />
        <KpiCard label={HSE_REPORTS_COPY.kpiConfirmed} value={confirmed} tone="warn" />
        <KpiCard label={HSE_REPORTS_COPY.kpiFalsePositive} value={falsePositives} tone="neutral" />
      </div>

      <Panel
        title={HSE_REPORTS_COPY.panelTitle}
        description={
          period === 'today'
            ? HSE_REPORTS_COPY.todayDesc
            : HSE_REPORTS_COPY.periodDesc(period === '7d' ? HSE_REPORTS_COPY.days7 : HSE_REPORTS_COPY.days30)
        }
      >
        {filtered.length === 0 ? (
          <EmptyRow>{HSE_REPORTS_COPY.empty}</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.code}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.title}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.severity}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.status}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.zone}</th>
                  <th className="pb-2 font-semibold">{HSE_COMMON_COPY.detectedAt}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inc) => (
                  <tr
                    key={inc.id}
                    className={cn('border-b border-slate-100 last:border-0', inc.falsePositive && 'opacity-70')}
                  >
                    <td className="py-2 pl-3 font-mono text-xs text-slate-700">{inc.code}</td>
                    <td className="max-w-[260px] py-2 pl-3 font-medium text-slate-900">{inc.title}</td>
                    <td className="py-2 pl-3">
                      <SeverityBadge value={inc.severity} />
                    </td>
                    <td className="py-2 pl-3">
                      <StatusBadge value={inc.status} />
                    </td>
                    <td className="py-2 pl-3 text-slate-700">
                      {getZone(inc.zoneId)?.name ?? inc.zoneId}
                    </td>
                    <td className="py-2 whitespace-nowrap text-xs tabular-nums text-slate-600">
                      {formatDateTime(inc.detectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
