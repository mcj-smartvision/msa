'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Minus, Printer, Settings2, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber, jalaliDate, jalaliDateTime } from '@/features/manager/lib/format'
import { formatTraceValue } from '@/features/calc-trace/lib/build'
import type { CalcTrace, CalcTraceMap, CalcTraceStatus } from '@/features/calc-trace/lib/types'

interface CalcTraceContextValue {
  traces: CalcTraceMap
  /** `?calc_debug=1`: triggers stay visible instead of appearing on hover. */
  debug: boolean
  open: (metrics: string[]) => void
}

const CalcTraceContext = createContext<CalcTraceContextValue | null>(null)

/**
 * Holds the traces that came with the page data (only system admins receive them) and renders the
 * «موشن حساب» drawer. Opening a trace never fetches: everything is already in `traces`.
 */
export function CalcTraceProvider({ traces, children }: { traces: CalcTraceMap | null | undefined; children: ReactNode }) {
  const [openMetrics, setOpenMetrics] = useState<string[] | null>(null)
  const [debug, setDebug] = useState(false)

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get('calc_debug') === '1')
  }, [])

  const open = useCallback((metrics: string[]) => setOpenMetrics(metrics), [])
  const value = useMemo<CalcTraceContextValue>(() => ({ traces: traces ?? {}, debug, open }), [traces, debug, open])
  const shown = openMetrics?.map((m) => value.traces[m]).filter((t): t is CalcTrace => Boolean(t)) ?? []

  return (
    <CalcTraceContext.Provider value={value}>
      {children}
      {shown.length ? <CalcTraceDrawer traces={shown} onClose={() => setOpenMetrics(null)} /> : null}
    </CalcTraceContext.Provider>
  )
}

/** Gear button of a KPI. Renders nothing unless at least one of `metrics` has a trace (admins only). */
export function CalcTraceTrigger({ metrics, className }: { metrics: string[]; className?: string }) {
  const ctx = useContext(CalcTraceContext)
  if (!ctx) return null
  const available = metrics.filter((m) => ctx.traces[m])
  if (available.length === 0) return null
  const first = ctx.traces[available[0]!]!
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        ctx.open(available)
      }}
      aria-label={`موشن حساب: ${first.label}`}
      title={`موشن حساب — ${first.label}`}
      className={cn(
        'pointer-events-auto relative z-10 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-opacity duration-150 hover:bg-orange-50 hover:text-orange-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60',
        !ctx.debug && 'md:opacity-0 md:group-hover:opacity-100 md:group-hover/card:opacity-100',
        className
      )}
    >
      <Settings2 className="h-4 w-4" aria-hidden />
    </button>
  )
}

/* ------------------------------------------------------------------ Drawer */

const STATUS_META: Record<CalcTraceStatus, { label: string; className: string }> = {
  ok: { label: 'سالم', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  warning: { label: 'نیاز به توجه', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  critical: { label: 'بحرانی', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  insufficient: { label: 'داده کافی نیست', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function CalcTraceDrawer({ traces, onClose }: { traces: CalcTrace[]; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const trace = traces[Math.min(active, traces.length - 1)]!

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [onClose])

  const print = () => {
    const root = document.documentElement
    root.classList.add('calc-trace-printing')
    const done = () => {
      root.classList.remove('calc-trace-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[90]" dir="rtl" lang="fa">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-slate-900/30" data-calc-noprint />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calc-trace-title"
        data-calc-print
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white text-right shadow-2xl animate-in slide-in-from-right duration-200 motion-reduce:animate-none md:w-[480px]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4">
          <h2 id="calc-trace-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Settings2 className="h-4 w-4 text-orange-600" aria-hidden />
            موشن حساب
          </h2>
          <div className="flex items-center gap-1" data-calc-noprint>
            <button
              type="button"
              onClick={print}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
            >
              <Printer className="h-4 w-4" aria-hidden />
              چاپ
            </button>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label="بستن موشن حساب"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {traces.length > 1 ? (
          <div role="tablist" aria-label="شاخص‌ها" className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2.5" data-calc-noprint>
            {traces.map((t, i) => (
              <button
                key={t.metric}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60',
                  i === active ? 'bg-orange-600 font-semibold text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {t.label.split(' — ')[0]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <TraceBody trace={trace} />
        </div>
      </div>
    </div>
  )
}

function TraceBody({ trace }: { trace: CalcTrace }) {
  const status = STATUS_META[trace.status]
  return (
    <div className="space-y-5 text-sm">
      <section>
        <p className="text-xs text-slate-500">{trace.metric}</p>
        <h3 className="mt-0.5 text-base font-bold text-slate-900">{trace.label}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{formatTraceValue(trace.result, trace.unit)}</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset', status.className)}>{status.label}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">محاسبه: {jalaliDateTime(trace.computedAt)}</p>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700">فرمول</h4>
        <p dir="auto" className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[12px] leading-6 text-slate-800 ring-1 ring-slate-200">
          {trace.formula}
        </p>
        <p dir="auto" className="rounded-lg bg-orange-50/60 px-3 py-2 text-[12px] leading-6 tabular-nums text-slate-800 ring-1 ring-orange-100">
          {trace.formulaHuman}
        </p>
      </section>

      {trace.warnings.length ? (
        <section className="space-y-1.5">
          {trace.warnings.map((w) => (
            <p
              key={w}
              role="alert"
              className={cn(
                'flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-6',
                trace.status === 'critical' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900'
              )}
            >
              <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
              {w}
            </p>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700">ورودی‌ها ({faNumber(trace.inputs.length)})</h4>
        {trace.inputs.length === 0 ? (
          <p className="text-xs text-slate-500">ورودی ثبت‌شده‌ای نیست.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2.5 py-2 text-right font-semibold">نام</th>
                  <th className="px-2.5 py-2 text-left font-semibold">مقدار</th>
                  <th className="px-2.5 py-2 text-right font-semibold">منبع</th>
                </tr>
              </thead>
              <tbody>
                {trace.inputs.map((input) => (
                  <tr key={input.key} className="border-t border-slate-100 align-top">
                    <td className="px-2.5 py-2 text-slate-800">{input.label}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-left font-semibold tabular-nums text-slate-900">
                      {formatTraceValue(input.value, input.unit)}
                    </td>
                    <td className="px-2.5 py-2 text-[11px] leading-5 text-slate-500">
                      {input.source.table ? <span className="block font-mono text-slate-600" dir="ltr">{input.source.table}</span> : null}
                      {input.source.column ? (
                        <span className="block" dir="auto">
                          ستون: <span className="font-mono">{input.source.column}</span>
                        </span>
                      ) : null}
                      {input.source.rowId ? (
                        <span className="block truncate" title={input.source.rowId}>
                          ردیف: <span className="font-mono" dir="ltr">{input.source.rowId.slice(0, 8)}</span>
                        </span>
                      ) : null}
                      {input.source.note ? <span className="block">{input.source.note}</span> : null}
                      {input.updatedAt ? <span className="block">به‌روزرسانی: {jalaliDate(input.updatedAt)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <HistorySection trace={trace} />
    </div>
  )
}

function HistorySection({ trace }: { trace: CalcTrace }) {
  const prev = trace.previousPeriod
  const delta = prev?.result != null && trace.result != null ? trace.result - prev.result : null
  const values = trace.history.map((p) => p.result).filter((x): x is number => x != null)
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold text-slate-700">دورهٔ قبل و روند</h4>
      {prev ? (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-slate-700">
          دورهٔ قبل: <span className="font-semibold tabular-nums">{formatTraceValue(prev.result, trace.unit)}</span>
          {delta != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                Math.abs(delta) < 1e-9 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-700'
              )}
            >
              {Math.abs(delta) < 1e-9 ? <Minus className="h-3 w-3" aria-hidden /> : delta > 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
              {formatTraceValue(Math.abs(delta), trace.unit)}
            </span>
          ) : null}
          <span className="text-slate-500">({jalaliDate(prev.computedAt)})</span>
        </p>
      ) : (
        <p className="text-[12px] text-slate-500">مقداری از روزهای قبل ثبت نشده است.</p>
      )}
      {values.length >= 2 ? <Sparkline values={values} /> : null}
      {trace.history.length ? (
        <ol className="space-y-0.5 text-[11px] text-slate-600">
          {[...trace.history].reverse().map((p) => (
            <li key={p.computedAt} className="flex justify-between gap-2 border-b border-dashed border-slate-100 py-0.5">
              <span>{jalaliDateTime(p.computedAt)}</span>
              <span className="font-semibold tabular-nums text-slate-800">{formatTraceValue(p.result, trace.unit)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {trace.historyNote ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">{trace.historyNote}</p> : null}
    </section>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const w = 240
  const h = 40
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((val, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((val - min) / span) * (h - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full max-w-[240px]" role="img" aria-label="روند مقادیر ثبت‌شده" style={{ direction: 'ltr' }}>
      <polyline points={points} fill="none" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
