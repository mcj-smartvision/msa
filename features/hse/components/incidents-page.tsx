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
        title="حوادث"
        description="فهرست قابل جستجوی همه تشخیص‌های ایمنی دوربین برای این پروژه."
      />

      <Panel
        title="ثبت حوادث"
        description={`${rows.length} رکورد`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی کد، عنوان، زون…"
                className="h-8 w-[200px] pr-8 text-xs"
              />
            </div>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | 'all')}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="شدت" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'همه شدت‌ها' : severityLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus | 'all')}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'همه وضعیت‌ها' : statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow>هیچ حادثه‌ای با پالایش فعلی مطابقت ندارد.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">کد</th>
                  <th className="pb-2 pl-3 font-semibold">عنوان</th>
                  <th className="pb-2 pl-3 font-semibold">شدت</th>
                  <th className="pb-2 pl-3 font-semibold">وضعیت</th>
                  <th className="pb-2 pl-3 font-semibold">زون</th>
                  <th className="pb-2 pl-3 font-semibold">دوربین</th>
                  <th className="pb-2 pl-3 font-semibold">اطمینان</th>
                  <th className="pb-2 font-semibold">زمان تشخیص</th>
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
