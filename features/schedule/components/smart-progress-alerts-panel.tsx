/**
 * @file features/schedule/components/smart-progress-alerts-panel.tsx
 * @purpose کامپوننت UI — زمان‌بندی، WBS و گانت (smart-progress-alerts-panel)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on shared/lib/utils, features/project-store/use-store-progress
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
AlertTriangle,
ChevronDown,
ChevronUp,
ExternalLink,
Loader2,
RefreshCw,
Settings2,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { storePercentOf, useStoreProgress } from '@/features/project-store/use-store-progress'
import { SCHEDULE_ALERTS_COPY } from '@/features/schedule/config'

type PaceStatus = 'good' | 'warning' | 'bad'
type AlertQuadrant = 'urgent' | 'normal_watch' | 'soft_notice' | 'no_display'

type PaceRow = {
  id: string
  wbs: string | null
  name: string
  actualStart: string | null
  physicalPercent: number
  durationDays: number | null
  expectedPercent: number | null
  elapsedDays: number | null
  paceRatio: number | null
  paceStatus: PaceStatus | null
  paceStatusFa: string
  isCritical: boolean
  totalFloatDays: number | null
  alertQuadrant: AlertQuadrant | null
  alertQuadrantFa: string
}

type AlertSettingsDto = {
  paceGoodThreshold: number
  paceWarningThreshold: number
  nearCriticalDays: number
}

type PaceResponse = {
  statusDate: string
  settings?: AlertSettingsDto
  counts: {
    good: number
    warning: number
    bad: number
    total: number
    urgent?: number
    normalWatch?: number
    softNotice?: number
    noDisplay?: number
  }
  rows: PaceRow[]
  error?: string
}

const QUADRANT_ORDER: AlertQuadrant[] = [
  'urgent',
  'soft_notice',
  'normal_watch',
  'no_display',
]

function rowBg(q: AlertQuadrant | null, physicalPercent?: number): string {
  if (physicalPercent != null && physicalPercent >= 100) return 'bg-emerald-50/50'
  if (physicalPercent != null && physicalPercent <= 0 && q == null) return 'bg-slate-50'
  if (q === 'urgent') return 'bg-rose-100/95'
  if (q === 'normal_watch') return 'bg-sky-50/95'
  if (q === 'soft_notice') return 'bg-amber-50/95'
  if (q === 'no_display') return 'bg-emerald-50/40'
  return 'bg-white'
}

function quadrantBadgeClass(q: AlertQuadrant | null, label?: string): string {
  if (label === SCHEDULE_ALERTS_COPY.notStarted) return 'bg-slate-200 text-slate-700 border-slate-300'
  if (label === SCHEDULE_ALERTS_COPY.finished) return 'bg-emerald-100 text-emerald-900 border-emerald-300'
  if (q === 'urgent') return 'bg-rose-600 text-white border-rose-700'
  if (q === 'normal_watch') return 'bg-sky-200 text-sky-950 border-sky-400'
  if (q === 'soft_notice') return 'bg-amber-200 text-amber-950 border-amber-400'
  if (q === 'no_display') return 'bg-emerald-100 text-emerald-900 border-emerald-300'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function ganttTaskHref(projectId: string, taskId: string, asSupervisor: boolean): string {
  const params = new URLSearchParams()
  params.set('section', 'schedule')
  params.set('workshopTab', 'gantt')
  params.set('projectId', projectId)
  params.set('ganttTaskId', taskId)
  if (asSupervisor) params.set('as', 'supervisor')
  return `/dashboard/technical-office?${params.toString()}`
}

function CompactLegend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
      <div className="mb-1.5 text-[11px] font-bold text-slate-800">
        {SCHEDULE_ALERTS_COPY.legendTitle}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <div className="rounded border border-rose-400 bg-rose-100 px-2 py-1.5 text-[10px] text-rose-950">
          <div className="font-bold">{SCHEDULE_ALERTS_COPY.redUrgent}</div>
          <div>{SCHEDULE_ALERTS_COPY.redHint}</div>
        </div>
        <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[10px] text-sky-950">
          <div className="font-bold">{SCHEDULE_ALERTS_COPY.blueWatch}</div>
          <div>{SCHEDULE_ALERTS_COPY.blueHint}</div>
        </div>
        <div className="rounded border border-amber-400 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-950">
          <div className="font-bold">{SCHEDULE_ALERTS_COPY.yellowSoft}</div>
          <div>{SCHEDULE_ALERTS_COPY.yellowHint}</div>
        </div>
        <div className="rounded border border-emerald-300 bg-emerald-50/80 px-2 py-1.5 text-[10px] text-emerald-900">
          <div className="font-bold">{SCHEDULE_ALERTS_COPY.greenNormal}</div>
          <div>{SCHEDULE_ALERTS_COPY.greenHint}</div>
        </div>
      </div>
    </div>
  )
}

function ProgressAlertSettingsForm({
  projectId,
  settings,
  onSaved,
  disabled,
}: {
  projectId: string
  settings: AlertSettingsDto | null | undefined
  onSaved: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [good, setGood] = useState('0.9')
  const [warning, setWarning] = useState('0.6')
  const [nearDays, setNearDays] = useState('5')

  useEffect(() => {
    if (!settings) return
    setGood(String(settings.paceGoodThreshold))
    setWarning(String(settings.paceWarningThreshold))
    setNearDays(String(settings.nearCriticalDays))
  }, [settings])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch('/api/schedule/alert-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          paceGoodThreshold: Number(good),
          paceWarningThreshold: Number(warning),
          nearCriticalDays: Number(nearDays),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || SCHEDULE_ALERTS_COPY.saveFailed)
      onSaved()
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : SCHEDULE_ALERTS_COPY.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        <span className="inline-flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-600" />
          {SCHEDULE_ALERTS_COPY.thresholds}
          {settings ? (
            <span className="text-[10px] font-normal text-slate-500 tabular-nums">
              {SCHEDULE_ALERTS_COPY.thresholdSummary(
                settings.paceGoodThreshold,
                settings.paceWarningThreshold,
                settings.nearCriticalDays
              )}
            </span>
          ) : null}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <form onSubmit={(e) => void save(e)} className="border-t border-slate-100 px-3 py-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-[11px] text-slate-600">
              pace_good
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={1}
                value={good}
                onChange={(e) => setGood(e.target.value)}
                disabled={disabled || saving}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="block text-[11px] text-slate-600">
              pace_warning
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={1}
                value={warning}
                onChange={(e) => setWarning(e.target.value)}
                disabled={disabled || saving}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="block text-[11px] text-slate-600">
              near_critical_days
              <input
                type="number"
                step="1"
                min={0}
                value={nearDays}
                onChange={(e) => setNearDays(e.target.value)}
                disabled={disabled || saving}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
          </div>
          {err ? <p className="text-xs text-rose-700">{err}</p> : null}
          <button
            type="submit"
            disabled={disabled || saving}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {saving ? SCHEDULE_ALERTS_COPY.savingDots : SCHEDULE_ALERTS_COPY.save}
          </button>
        </form>
      ) : null}
    </div>
  )
}

function ColoredActivityTable({
  rows,
  projectId,
  asSupervisor,
  filterExceptionsOnly,
}: {
  rows: PaceRow[]
  projectId: string
  asSupervisor: boolean
  filterExceptionsOnly: boolean
}) {
  const visible = filterExceptionsOnly
    ? rows.filter((r) => r.alertQuadrant === 'urgent' || r.alertQuadrant === 'soft_notice')
    : rows

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        {SCHEDULE_ALERTS_COPY.emptyHeaders}
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b bg-slate-100 text-[11px] text-slate-700">
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colColor}</th>
            <th className="px-2 py-2 text-center font-semibold">WBS</th>
            <th className="px-2 py-2 text-right font-semibold">{SCHEDULE_ALERTS_COPY.colHeader}</th>
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colProgress}</th>
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colFloat}</th>
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colPace}</th>
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colActualStart}</th>
            <th className="px-2 py-2 text-center font-semibold">{SCHEDULE_ALERTS_COPY.colGantt}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.id}
              className={cn('border-b border-slate-200/70', rowBg(row.alertQuadrant, row.physicalPercent))}
            >
              <td className="px-2 py-2 text-center">
                <span
                  className={cn(
                    'inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold',
                    quadrantBadgeClass(row.alertQuadrant, row.alertQuadrantFa)
                  )}
                >
                  {row.alertQuadrantFa}
                </span>
              </td>
              <td className="px-2 py-1.5 text-center font-mono text-[11px] tabular-nums">
                {row.wbs ?? '—'}
              </td>
              <td className="px-2 py-2 text-right">
                <span className="font-semibold text-slate-900">{row.name}</span>
                {row.isCritical ? (
                  <span className="ms-1 rounded bg-rose-700 px-1 py-0.5 text-[9px] text-white">
                    {SCHEDULE_ALERTS_COPY.critical}
                  </span>
                ) : null}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-semibold">
                {Math.round(row.physicalPercent)}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums">
                {row.totalFloatDays != null ? row.totalFloatDays : '—'}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-bold">
                {row.paceRatio != null ? row.paceRatio.toFixed(2) : '—'}
              </td>
              <td className="px-2 py-1.5 text-center text-[11px] tabular-nums">
                {row.actualStart ?? '—'}
              </td>
              <td className="px-2 py-1.5 text-center">
                <Link
                  href={ganttTaskHref(projectId, row.id, asSupervisor)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white/80 px-2 py-1 text-[11px] font-medium hover:bg-white"
                >
                  <ExternalLink className="h-3 w-3" />
                  {SCHEDULE_ALERTS_COPY.gantt}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SmartProgressAlertsPanel({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams()
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const storeProgress = useStoreProgress(projectId || null)

  const [data, setData] = useState<PaceResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [exceptionsOnly, setExceptionsOnly] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/schedule/progress-pace?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || SCHEDULE_ALERTS_COPY.loadFailed)
      setData(json)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : SCHEDULE_ALERTS_COPY.error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const syncFromSchedule = useCallback(async () => {
    if (!projectId) return
    setRecomputing(true)
    setMessage(null)
    try {
      // Always refresh live list from percent_complete (works without pace columns)
      await load()
      const res = await fetch('/api/schedule/progress-pace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        const urgent = json.urgentAlertsCreated ?? 0
        setMessage(
          SCHEDULE_ALERTS_COPY.colored(json.inProgress ?? 0) +
            (urgent > 0 ? SCHEDULE_ALERTS_COPY.urgentAlerts(urgent) : '')
        )
        await load()
      } else if (typeof json.error === 'string' && /pace_ratio|does not exist/i.test(json.error)) {
        setMessage(SCHEDULE_ALERTS_COPY.liveListHint)
      } else if (json.error) {
        setMessage(String(json.error))
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : SCHEDULE_ALERTS_COPY.error)
    } finally {
      setRecomputing(false)
    }
  }, [projectId, load])

  useEffect(() => {
    void (async () => {
      if (!projectId) return
      await load()
      // Persist is optional (migrations 77/78); never block the live list
      try {
        const res = await fetch('/api/schedule/progress-pace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        if (res.ok) await load()
      } catch {
        // keep live GET
      }
    })()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const coloredRows = useMemo(() => {
    const rows = [...(data?.rows ?? [])].map((row) => {
      if (!storeProgress.ready) return row
      const percent = storePercentOf(storeProgress.percents, row.id, row.physicalPercent)
      return percent == null ? row : { ...row, physicalPercent: percent }
    })
    rows.sort((a, b) => {
      const ai = a.alertQuadrant ? QUADRANT_ORDER.indexOf(a.alertQuadrant) : 99
      const bi = b.alertQuadrant ? QUADRANT_ORDER.indexOf(b.alertQuadrant) : 99
      if (ai !== bi) return ai - bi
      return (a.wbs ?? '').localeCompare(b.wbs ?? '', 'en', { numeric: true })
    })
    return rows
  }, [data?.rows, storeProgress.ready, storeProgress.percents])

  const counts = data?.counts

  return (
    <div className="space-y-3 w-full" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{SCHEDULE_ALERTS_COPY.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 leading-relaxed">
            <strong className="font-semibold">{SCHEDULE_ALERTS_COPY.descriptionLead}</strong>
            {SCHEDULE_ALERTS_COPY.descriptionRest}
          </p>
          {data?.statusDate ? (
            <p className="mt-1 text-xs text-slate-500 tabular-nums">
              {SCHEDULE_ALERTS_COPY.statusDate(data.statusDate)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || recomputing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {SCHEDULE_ALERTS_COPY.refresh}
          </button>
          <button
            type="button"
            onClick={() => void syncFromSchedule()}
            disabled={loading || recomputing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {recomputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            {SCHEDULE_ALERTS_COPY.syncEdited}
          </button>
        </div>
      </div>

      <CompactLegend />

      {counts ? (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-rose-300 bg-rose-100 px-2.5 py-1 font-semibold text-rose-950">
            {SCHEDULE_ALERTS_COPY.urgentCount(counts.urgent ?? 0)}
          </span>
          <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 font-semibold text-sky-950">
            {SCHEDULE_ALERTS_COPY.watchCount(counts.normalWatch ?? 0)}
          </span>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-950">
            {SCHEDULE_ALERTS_COPY.softCount(counts.softNotice ?? 0)}
          </span>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-900">
            {SCHEDULE_ALERTS_COPY.normalCount(counts.noDisplay ?? 0)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
            {SCHEDULE_ALERTS_COPY.totalHeaders(counts.total)}
          </span>
        </div>
      ) : null}

      {message && /pace_ratio|does not exist/i.test(message) ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {SCHEDULE_ALERTS_COPY.migrationBefore}{' '}
          <code className="text-xs">database/77-progress-pace.sql</code>{' '}
          {SCHEDULE_ALERTS_COPY.migrationAnd}{' '}
          <code className="text-xs">database/78-progress-alert-quadrant.sql</code>
          {SCHEDULE_ALERTS_COPY.migrationAfter}
        </div>
      ) : message ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">
          {SCHEDULE_ALERTS_COPY.allHeaders(coloredRows.length)}
        </h3>
        <button
          type="button"
          onClick={() => setExceptionsOnly((v) => !v)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50"
        >
          {exceptionsOnly ? SCHEDULE_ALERTS_COPY.showAllColors : SCHEDULE_ALERTS_COPY.exceptionsOnly}
        </button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {SCHEDULE_ALERTS_COPY.loading}
        </div>
      ) : (
        <ColoredActivityTable
          rows={coloredRows}
          projectId={projectId}
          asSupervisor={asSupervisor}
          filterExceptionsOnly={exceptionsOnly}
        />
      )}

      <ProgressAlertSettingsForm
        projectId={projectId}
        settings={data?.settings}
        onSaved={() => void syncFromSchedule()}
        disabled={loading || recomputing}
      />
    </div>
  )
}
