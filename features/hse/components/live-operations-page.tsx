/**
 * @file features/hse/components/live-operations-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (live-operations-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/format, features/hse/components/ui, shared/components/ui/button, shared/components/ui/select, features/hse/lib/mock-data, features/hse/lib/types, shared/lib/utils, features/hse/config
 */

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
import { SeverityBadge, StatusBadge, severityLabel, statusLabel } from '@/features/hse/components/badges'
import { formatDateTime } from '@/features/hse/components/format'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import {
getCamera,
getZone,
HSE_INCIDENTS,
} from '@/features/hse/lib/mock-data'
import type { DecisionAction, HseIncident, IncidentStatus, Severity } from '@/features/hse/lib/types'
import { cn } from '@/shared/lib/utils'
import {
  HSE_ACTION_COPY,
  HSE_COMMON_COPY,
  HSE_LIVE_COPY,
  HSE_VERDICT_COPY,
} from '@/features/hse/config'

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
  acknowledge: HSE_ACTION_COPY.acknowledge,
  confirm: HSE_ACTION_COPY.confirm,
  dismiss: HSE_ACTION_COPY.dismiss,
  escalate: HSE_ACTION_COPY.escalate,
  assign: HSE_ACTION_COPY.assign,
  close: HSE_ACTION_COPY.close,
}

const VERDICT_LABEL: Record<HseIncident['aiVerdict'], string> = HSE_VERDICT_COPY

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
        ? HSE_LIVE_COPY.assignNote
        : HSE_LIVE_COPY.actionApplied(ACTION_LABEL[action])
    const now = new Date().toISOString()

    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== selected.id) return inc
        return {
          ...inc,
          status: nextStatus,
          updatedAt: now,
          assignee: action === 'assign' ? HSE_LIVE_COPY.demoAssignee : inc.assignee,
          falsePositive: action === 'dismiss' ? true : inc.falsePositive,
          decisionLog: [
            ...inc.decisionLog,
            {
              id: `dl-live-${Date.now()}`,
              at: now,
              actor: HSE_LIVE_COPY.actorYou,
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
        title={HSE_LIVE_COPY.title}
        description={HSE_LIVE_COPY.description}
        actions={
          lastAction ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              {HSE_LIVE_COPY.lastActionPrefix}{lastAction}
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel
          title={HSE_LIVE_COPY.listTitle}
          description={HSE_LIVE_COPY.matching(filtered.length)}
          actions={
            <div className="flex flex-wrap gap-2">
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as Severity | 'all')}
              >
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')}
              >
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
          {filtered.length === 0 ? (
            <EmptyRow>{HSE_LIVE_COPY.empty}</EmptyRow>
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
          title={HSE_LIVE_COPY.detailTitle}
          description={selected ? selected.code : HSE_LIVE_COPY.selectIncident}
        >
          {!selected ? (
            <EmptyRow>{HSE_LIVE_COPY.selectFromList}</EmptyRow>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SeverityBadge value={selected.severity} />
                  <StatusBadge value={selected.status} />
                  <span className="text-xs text-slate-500">
                    {HSE_LIVE_COPY.confidence(Math.round(selected.confidence * 100))}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{selected.title}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {HSE_LIVE_COPY.zonePrefix}{getZone(selected.zoneId)?.name ?? selected.zoneId} · {HSE_LIVE_COPY.cameraPrefix}
                  {getCamera(selected.cameraId)?.name ?? selected.cameraId} · {HSE_LIVE_COPY.detectedPrefix}
                  {formatDateTime(selected.detectedAt)}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
                  {HSE_LIVE_COPY.evidencePreview}
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
                  {HSE_LIVE_COPY.aiSummary}
                </p>
                <p className="mt-1 text-sm text-slate-800">{selected.aiSummary}</p>
                <p className="mt-2 text-xs font-medium text-slate-700">
                  {HSE_LIVE_COPY.verdictPrefix}
                  <span className="tracking-wide">
                    {VERDICT_LABEL[selected.aiVerdict]}
                  </span>{' '}
                  ({Math.round(selected.aiConfidence * 100)}٪)
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
                  {HSE_LIVE_COPY.actions}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => applyAction('acknowledge')}>
                    <Check className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.acknowledge}
                  </Button>
                  <Button size="sm" variant="default" onClick={() => applyAction('confirm')}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.confirm}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applyAction('dismiss')}>
                    <X className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.dismiss}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => applyAction('escalate')}>
                    <Zap className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.escalate}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => applyAction('assign')}>
                    <UserPlus className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.assign}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => applyAction('close')}>
                    <ClipboardList className="h-3.5 w-3.5" />
                    {HSE_ACTION_COPY.close}
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
