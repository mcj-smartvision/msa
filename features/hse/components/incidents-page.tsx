/**
 * @file features/hse/components/incidents-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (incidents-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/format, features/hse/components/ui, shared/components/ui/input, shared/components/ui/select, features/hse/lib/mock-data, features/hse/lib/nav, features/hse/lib/types, features/hse/config
 */

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { SeverityBadge, StatusBadge, severityLabel, statusLabel } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Input } from '@/shared/components/ui/input'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { getCamera, getZone, HSE_INCIDENTS } from '@/features/hse/lib/mock-data'
import { HSE_BASE } from '@/features/hse/lib/nav'
import type { IncidentStatus, Severity } from '@/features/hse/lib/types'
import { HSE_COMMON_COPY, HSE_INCIDENTS_COPY } from '@/features/hse/config'

const SEVERITIES: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low']
const STATUSES: Array<IncidentStatus | 'all'> = [
  'all',
  'new',
  'acknowledged',
  'ai_review',
  'confirmed',
  'dismissed',
  'escalated',
  'assigned',
  'closed',
]

export function IncidentsPage() {
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [status, setStatus] = useState<IncidentStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...HSE_INCIDENTS]
      .filter((i) => {
        if (severity !== 'all' && i.severity !== severity) return false
        if (status !== 'all' && i.status !== status) return false
        if (!q) return true
        const zone = getZone(i.zoneId)?.name ?? ''
        const camera = getCamera(i.cameraId)?.name ?? ''
        return (
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          zone.toLowerCase().includes(q) ||
          camera.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt))
  }, [severity, status, search])

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={HSE_INCIDENTS_COPY.title}
        description={HSE_INCIDENTS_COPY.description}
      />

      <Panel
        title={HSE_INCIDENTS_COPY.panelTitle}
        description={HSE_INCIDENTS_COPY.recordCount(rows.length)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={HSE_INCIDENTS_COPY.searchPlaceholder}
                className="h-8 w-[200px] pr-8 text-xs"
              />
            </div>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | 'all')}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder={HSE_COMMON_COPY.severity} />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? HSE_COMMON_COPY.allSeverities : severityLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus | 'all')}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder={HSE_COMMON_COPY.status} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? HSE_COMMON_COPY.allStatuses : statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow>{HSE_INCIDENTS_COPY.empty}</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.code}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.title}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.severity}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.status}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.zone}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.camera}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_COMMON_COPY.confidence}</th>
                  <th className="pb-2 font-semibold">{HSE_COMMON_COPY.detectedAt}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inc) => (
                  <tr
                    key={inc.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-0"
                  >
                    <td className="py-2 pl-3">
                      <Link
                        href={`${HSE_BASE}/incidents/${inc.id}`}
                        className="font-mono text-xs font-medium text-amber-800 hover:underline"
                      >
                        {inc.code}
                      </Link>
                    </td>
                    <td className="max-w-[240px] py-2 pl-3">
                      <Link
                        href={`${HSE_BASE}/incidents/${inc.id}`}
                        className="line-clamp-2 font-medium text-slate-900 hover:underline"
                      >
                        {inc.title}
                      </Link>
                    </td>
                    <td className="py-2 pl-3">
                      <SeverityBadge value={inc.severity} />
                    </td>
                    <td className="py-2 pl-3">
                      <StatusBadge value={inc.status} />
                    </td>
                    <td className="py-2 pl-3 text-slate-700">
                      {getZone(inc.zoneId)?.name ?? inc.zoneId}
                    </td>
                    <td className="py-2 pl-3 text-slate-700">
                      {getCamera(inc.cameraId)?.code ?? inc.cameraId}
                    </td>
                    <td className="py-2 pl-3 tabular-nums text-slate-700">
                      {Math.round(inc.confidence * 100)}٪
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
