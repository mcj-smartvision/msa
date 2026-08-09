'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  ClipboardList,
  ShieldAlert,
  UserPlus,
  X,
  Zap,
} from 'lucide-react'
import { SeverityBadge, StatusBadge, severityLabel, statusLabel } from '@/components/hse/badges'
import { formatDateTime } from '@/components/hse/format'
import { EmptyRow, HsePageHeader, Panel } from '@/components/hse/ui'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getCamera,
  getZone,
  HSE_INCIDENTS,
} from '@/lib/hse/mock-data'
import type { DecisionAction, HseIncident, IncidentStatus, Severity } from '@/lib/hse/types'
import { cn } from '@/lib/utils'

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

const ACTION_STATUS: Record<
  Exclude<DecisionAction, 'ai_verify' | 'note'>,
  IncidentStatus
> = {
  acknowledge: 'acknowledged',
  confirm: 'confirmed',
  dismiss: 'dismissed',
  escalate: 'escalated',
  assign: 'assigned',
  close: 'closed',
}

const ACTION_LABEL: Record<keyof typeof ACTION_STATUS, string> = {
  acknowledge: 'دریافت',
  confirm: 'تأیید',
  dismiss: 'رد',
  escalate: 'ارجاع',
  assign: 'تخصیص',
  close: 'بستن',
}

const VERDICT_LABEL: Record<HseIncident['aiVerdict'], string> = {
  likely_violation: 'احتمال تخلف',
  uncertain: 'نامشخص',
  likely_false_positive: 'احتمال مثبت کاذب',
}

export function LiveOperationsPage() {
  const [incidents, setIncidents] = useState<HseIncident[]>(() =>
    [...HSE_INCIDENTS].sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt))
  )
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(
    () => incidents.find((i) => i.status === 'new' || i.status === 'ai_review')?.id ?? incidents[0]?.id ?? null
  )
  const [lastAction, setLastAction] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      return true
    })
  }, [incidents, severityFilter, statusFilter])

  const selected = incidents.find((i) => i.id === selectedId) ?? filtered[0] ?? null

  function applyAction(action: keyof typeof ACTION_STATUS) {
    if (!selected) return
    const nextStatus = ACTION_STATUS[action]
    const note =
      action === 'assign'
        ? 'تخصیص به ناظر کشیک (نمایشی)'
        : `${ACTION_LABEL[action]} اعمال شد (نمایشی)`
    const now = new Date().toISOString()

    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== selected.id) return inc
        return {
          ...inc,
          status: nextStatus,
          updatedAt: now,
          assignee: action === 'assign' ? 'مرتضی بل' : inc.assignee,
          falsePositive: action === 'dismiss' ? true : inc.falsePositive,
          decisionLog: [
            ...inc.decisionLog,
            {
              id: `dl-live-${Date.now()}`,
              at: now,
              actor: 'شما (اپراتور)',
              action,
              note,
            },
          ],
        }
      })
    )
    setLastAction(
      `${selected.code}: ${ACTION_LABEL[action]} ← ${statusLabel[nextStatus]}`
    )
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="عملیات زنده"
        description="فهرست قابل پالایش حوادث با پیش‌نمایش شواهد و اقدامات ناظر. تغییرات فقط در وضعیت نشست محلی اعمال می‌شود."
        actions={
          lastAction ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              آخرین اقدام: {lastAction}
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel
          title="فهرست حوادث"
          description={`${filtered.length} مورد مطابق`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as Severity | 'all')}
              >
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')}
              >
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
          {filtered.length === 0 ? (
            <EmptyRow>هیچ حادثه‌ای با پالایش فعلی مطابقت ندارد.</EmptyRow>
          ) : (
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
              {filtered.map((inc) => {
                const active = selected?.id === inc.id
                return (
                  <li key={inc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(inc.id)}
                      className={cn(
                        'w-full rounded border px-2.5 py-2 text-right transition-colors',
                        active
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500">{inc.code}</span>
                        <SeverityBadge value={inc.severity} />
                        <StatusBadge value={inc.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{inc.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {getZone(inc.zoneId)?.name ?? inc.zoneId} · {formatDateTime(inc.detectedAt)} ·{' '}
                        {Math.round(inc.confidence * 100)}٪
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="جزئیات حادثه"
          description={selected ? selected.code : 'یک حادثه را انتخاب کنید'}
        >
          {!selected ? (
            <EmptyRow>یک حادثه را از فهرست انتخاب کنید.</EmptyRow>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SeverityBadge value={selected.severity} />
                  <StatusBadge value={selected.status} />
                  <span className="text-xs text-slate-500">
                    اطمینان {Math.round(selected.confidence * 100)}٪
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{selected.title}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  زون: {getZone(selected.zoneId)?.name ?? selected.zoneId} · دوربین:{' '}
                  {getCamera(selected.cameraId)?.name ?? selected.cameraId} · تشخیص در{' '}
                  {formatDateTime(selected.detectedAt)}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
                  پیش‌نمایش شواهد
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selected.evidenceFrames.map((frame) => (
                    <div
                      key={frame.id}
                      className="flex aspect-video flex-col justify-between rounded border border-dashed border-slate-300 bg-slate-100 p-2"
                    >
                      <span className="text-[10px] font-semibold text-slate-500">
                        {frame.label}
                      </span>
                      <p className="line-clamp-3 text-[11px] leading-snug text-slate-700">
                        {frame.caption}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex h-24 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                  {selected.clipPlaceholder}
                </div>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                  خلاصه / رأی هوش مصنوعی
                </p>
                <p className="mt-1 text-sm text-slate-800">{selected.aiSummary}</p>
                <p className="mt-2 text-xs font-medium text-slate-700">
                  رأی:{' '}
                  <span className="tracking-wide">
                    {VERDICT_LABEL[selected.aiVerdict]}
                  </span>{' '}
                  ({Math.round(selected.aiConfidence * 100)}٪)
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
                  اقدامات
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => applyAction('acknowledge')}>
                    <Check className="h-3.5 w-3.5" />
                    دریافت
                  </Button>
                  <Button size="sm" variant="default" onClick={() => applyAction('confirm')}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    تأیید
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applyAction('dismiss')}>
                    <X className="h-3.5 w-3.5" />
                    رد
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => applyAction('escalate')}>
                    <Zap className="h-3.5 w-3.5" />
                    ارجاع
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applyAction('assign')}>
                    <UserPlus className="h-3.5 w-3.5" />
                    تخصیص
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => applyAction('close')}>
                    <ClipboardList className="h-3.5 w-3.5" />
                    بستن
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
