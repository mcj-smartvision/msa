'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Inbox, Loader2, X } from 'lucide-react'
import type { ExplainedKpi } from '@/types/project-controls'
import type { ControlsSnapshot } from '@/types/project-controls'
import type { ManagerOverview } from '@/lib/manager/overview-types'
import { buildPmInboxItems } from '@/lib/pm-inbox/build'
import type { DailyReportPulse, InboxAction, InboxCategory, InboxItem, InboxOwnerRole, InboxRoute, InboxSeverity } from '@/lib/pm-inbox/types'
import { DATA_QUALITY_FA } from '@/lib/project-controls/explained-metric'
import { faNumber, jalaliDate } from '@/lib/manager/format'
import { cn } from '@/lib/utils'
import type { ManagerHrefs } from './manager-sections'

const CATEGORY_FA: Record<InboxCategory, string> = {
  Controls: 'کنترل پروژه',
  LeanOps: 'عملیات ناب',
  Financials: 'مالی',
  Claims: 'ادعاها',
  HSE: 'ایمنی و HSE',
}
const CATEGORIES = Object.keys(CATEGORY_FA) as InboxCategory[]

const OWNER_FA: Record<InboxOwnerRole, string> = {
  PM: 'مدیر پروژه',
  Planner: 'برنامه‌ریز',
  QS: 'متره و برآورد',
  SiteManager: 'سرپرست کارگاه',
  HSE: 'مسئول HSE',
}

const SEVERITY_STYLE: Record<InboxSeverity, { dot: string; chip: string; label: string }> = {
  critical: { dot: 'bg-rose-600', chip: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'بحرانی' },
  warning: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'هشدار' },
  info: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'اطلاع' },
}

type ControlsLoad = { state: 'loading' } | { state: 'ok'; snapshot: ControlsSnapshot; kpis: Record<string, ExplainedKpi> } | { state: 'error'; message: string }

function useControls(projectId: string | null, refreshKey: string | null): ControlsLoad {
  const [load, setLoad] = useState<ControlsLoad>({ state: 'loading' })
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoad({ state: 'loading' })
    fetch(`/api/manager/controls?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || body?.error) setLoad({ state: 'error', message: body?.error ?? `خطای ${response.status}` })
        else setLoad({ state: 'ok', snapshot: body.snapshot, kpis: body.kpis })
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'خطای شبکه' })
      })
    return () => {
      cancelled = true
    }
  }, [projectId, refreshKey])
  return load
}

function dailyReportPulse(overview: ManagerOverview | null): DailyReportPulse | null {
  if (overview?.pulse.status !== 'ok') return null
  const source = overview.pulse.data.find((s) => s.key === 'daily_report')
  if (!source) return null
  return {
    status: source.status,
    lastActivityAt: source.lastActivityAt,
    thresholdHours: source.thresholdHours,
    responsible: source.responsible.map((p) => p.name),
    reason: source.reason,
  }
}

function routeHref(route: InboxRoute, hrefs: ManagerHrefs): string | undefined {
  switch (route) {
    case 'gantt':
      return hrefs.gantt
    case 'scheduleIntel':
      return hrefs.scheduleIntel ?? hrefs.gantt
    case 'finance':
      return hrefs.finance
    case 'evm':
      return hrefs.evm
    case 'procurement':
      return hrefs.procurement
    case 'background':
      return '/dashboard/manager/background'
    case 'wwp':
      return undefined
  }
}

type Toast = { tone: 'ok' | 'error' | 'info'; text: string; payload?: unknown }

function Explanation({ item }: { item: InboxItem }) {
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-700 ring-1 ring-inset ring-slate-200">
      <p>
        <span className="font-bold text-slate-800">چرا تولید شد: </span>
        قانون «{item.trigger.rule_fa}» فعال شد.
      </p>
      <p dir="ltr" className="rounded-lg bg-sky-50 px-2 py-1 text-left font-mono text-[11px] text-slate-800">{item.trigger.rule}</p>
      <p>
        <span className="font-bold text-slate-800">مقدار مشاهده‌شده: </span>
        {item.trigger.observed_fa}
      </p>
      {item.evidence.metrics.length ? (
        <ul className="space-y-0.5">
          {item.evidence.metrics.map((m) => (
            <li key={m.key} className="flex flex-wrap justify-between gap-2">
              <span>{m.label_fa}</span>
              <span className="tabular-nums text-slate-900">
                {m.value == null ? DATA_QUALITY_FA[m.data_quality] : typeof m.value === 'number' ? `${faNumber(m.value, 3)} ${m.unit ?? ''}` : /^\d{4}-\d{2}-\d{2}/.test(m.value) ? jalaliDate(m.value) : m.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-slate-500">
        منابع: {item.evidence.sources.join(' · ')} · تاریخ مبنا {jalaliDate(item.evidence.asOf)}
      </p>
    </div>
  )
}

function InboxRow({ item, onAction, busy }: { item: InboxItem; onAction: (item: InboxItem, action: InboxAction) => void; busy: string | null }) {
  const [open, setOpen] = useState(false)
  const sev = SEVERITY_STYLE[item.severity]
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', sev.dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-slate-800">{item.title_fa}</p>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset', sev.chip)}>{sev.label}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {CATEGORY_FA[item.category]} · مسئول پیشنهادی: {OWNER_FA[item.owner_role]} · موعد {jalaliDate(item.due_date)}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{item.description_fa}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.suggested_actions.map((action) => {
              const key = `${item.id}:${action.label_fa}`
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onAction(item, action)}
                  disabled={busy === key}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                >
                  {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {action.label_fa}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex h-7 items-center gap-0.5 px-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
            >
              چرا؟
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
          </div>
          {open ? <Explanation item={item} /> : null}
        </div>
      </div>
    </li>
  )
}

/** «اقدامات معوق و بحران‌ها»: actionable items generated from the explainable KPIs and data quality. */
export function PmInboxCard({
  projectId,
  overview,
  hrefs,
}: {
  projectId: string | null
  overview: ManagerOverview | null
  hrefs: ManagerHrefs
}) {
  const router = useRouter()
  const controls = useControls(projectId, overview?.generatedAt ?? null)
  const [filter, setFilter] = useState<InboxCategory | 'all'>('all')
  const [toast, setToast] = useState<Toast | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const items = useMemo(() => {
    if (controls.state !== 'ok' || !projectId) return null
    return buildPmInboxItems({
      projectId,
      today: overview?.site.date ?? controls.snapshot.asOf,
      controls: controls.snapshot,
      kpis: controls.kpis,
      dailyReport: dailyReportPulse(overview),
    })
  }, [controls, overview, projectId])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(timer)
  }, [toast])

  const onAction = useCallback(
    async (item: InboxItem, action: InboxAction) => {
      if (action.action_type === 'navigate') {
        const href = routeHref(action.payload.route, hrefs)
        if (!href) {
          setToast({ tone: 'info', text: `صفحهٔ «${action.label_fa}» برای نقش شما در دسترس نیست؛ اطلاعات اقدام آماده است.`, payload: action.payload })
          return
        }
        const query = new URLSearchParams(action.payload.query ?? {}).toString()
        router.push(query ? `${href}${href.includes('?') ? '&' : '?'}${query}` : href)
        return
      }
      if (action.action_type === 'draft') {
        setToast({ tone: 'info', text: `پیش‌نویس «${action.label_fa}» برای «${item.title_fa}» آماده شد. ثبت و ابلاغ آن با ماژول دستورکار فعال می‌شود.`, payload: action.payload })
        return
      }
      const key = `${item.id}:${action.label_fa}`
      setBusy(key)
      try {
        const response = await fetch(action.payload.url, {
          method: action.payload.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload.body),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'اقدام ناموفق بود')
        setToast({ tone: 'ok', text: `«${action.label_fa}» انجام شد.` })
      } catch (error) {
        setToast({ tone: 'error', text: error instanceof Error ? error.message : 'اقدام ناموفق بود', payload: action.payload })
      } finally {
        setBusy(null)
      }
    },
    [hrefs, router]
  )

  const counts = useMemo(() => {
    const map = new Map<InboxCategory, number>()
    for (const item of items ?? []) map.set(item.category, (map.get(item.category) ?? 0) + 1)
    return map
  }, [items])
  const visible = (items ?? []).filter((item) => filter === 'all' || item.category === filter)
  const critical = (items ?? []).filter((item) => item.severity === 'critical').length

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex min-h-[26px] items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <Inbox className="h-4 w-4 text-slate-500" aria-hidden />
          اقدامات معوق و بحران‌ها
        </p>
        {items ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset',
              critical > 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : items.length > 0 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            )}
          >
            {critical > 0 ? `${faNumber(critical)} بحرانی` : items.length > 0 ? `${faNumber(items.length)} مورد` : 'بدون مورد'}
          </span>
        ) : null}
      </div>

      {controls.state === 'loading' ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
      ) : controls.state === 'error' ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">صندوق اقدامات بارگذاری نشد: {controls.message}</p>
      ) : items && items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">هیچ تریگر فعالی نیست</p>
            <p className="mt-0.5 text-xs text-emerald-700">همهٔ شاخص‌ها در محدودهٔ مجاز و داده‌ها به‌روزند.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="فیلتر دسته‌ها">
            {(['all', ...CATEGORIES] as const).map((cat) => {
              const n = cat === 'all' ? items?.length ?? 0 : counts.get(cat) ?? 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  disabled={cat !== 'all' && n === 0}
                  aria-pressed={filter === cat}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:opacity-40',
                    filter === cat ? 'bg-slate-800 text-white ring-slate-800' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  )}
                >
                  {cat === 'all' ? 'همه' : CATEGORY_FA[cat]} {faNumber(n)}
                </button>
              )
            })}
          </div>
          <ul className="mt-1 max-h-[420px] divide-y divide-slate-100 overflow-y-auto pe-1">
            {visible.map((item) => (
              <InboxRow key={item.id} item={item} onAction={(i, a) => void onAction(i, a)} busy={busy} />
            ))}
          </ul>
        </>
      )}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'mt-3 rounded-xl px-3 py-2 text-[11px] leading-5 ring-1 ring-inset',
            toast.tone === 'ok' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : toast.tone === 'error' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-sky-50 text-sky-800 ring-sky-200'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p>{toast.text}</p>
            <button type="button" onClick={() => setToast(null)} aria-label="بستن" className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {toast.payload ? (
            <details className="mt-1">
              <summary className="cursor-pointer opacity-70">payload</summary>
              <pre dir="ltr" className="mt-1 overflow-x-auto text-left font-mono text-[10px]">{JSON.stringify(toast.payload, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
