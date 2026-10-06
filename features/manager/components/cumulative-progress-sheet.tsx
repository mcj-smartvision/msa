'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Calculator, Loader2, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import type { ExplainedCumulativeProgress } from '@/features/project-controls/lib/cumulative-progress'

type Load = { state: 'loading' } | { state: 'ok'; data: ExplainedCumulativeProgress } | { state: 'error'; message: string }

const pct = (v: number | null, d = 2) => (v == null ? '—' : `${faNumber(v, d)}٪`)
const toman = (v: number | null) => (v == null ? '—' : `${faNumber(Math.round(v))} تومان`)

function useCumulativeProgress(projectId: string, asOf: string | null): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  useEffect(() => {
    let cancelled = false
    setLoad({ state: 'loading' })
    const query = new URLSearchParams({ projectId, ...(asOf ? { asOf } : {}) })
    fetch(`/api/manager/cumulative-progress?${query}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || !body || body.error) setLoad({ state: 'error', message: body?.error ?? `خطای ${response.status}` })
        else setLoad({ state: 'ok', data: body as ExplainedCumulativeProgress })
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'خطای شبکه' })
      })
    return () => {
      cancelled = true
    }
  }, [projectId, asOf])
  return load
}

function Formula() {
  return (
    <div dir="ltr" className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-4 font-serif text-[17px] text-white">
      <span className="italic">Cum%</span>
      <span>=</span>
      <span className="inline-flex flex-col items-center leading-tight">
        <span className="px-1 pb-1">
          Σ (<i>W</i>
          <sub>i</sub> × <i>P</i>
          <sub>i</sub>)
        </span>
        <span className="w-full border-t border-white/70" />
        <span className="px-1 pt-1">
          Σ <i>W</i>
          <sub>i</sub>
        </span>
      </span>
      <span className="ms-4 text-[13px] font-sans text-slate-300">
        EV = BAC × Actual% · PV = BAC × Planned%
      </span>
    </div>
  )
}

function Stat({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: 'rose' | 'emerald' }) {
  return (
    <div className={cn('rounded-xl px-3 py-2 ring-1 ring-inset', highlight ? 'bg-orange-50 ring-orange-200' : 'bg-slate-50 ring-slate-200')}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[15px] font-black tabular-nums',
          tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-slate-900'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Body({ data, card }: { data: ExplainedCumulativeProgress; card: { planned: number | null; actual: number | null } }) {
  const byWeight = data.progress_basis === 'schedule_weight'
  const totals = data.breakdown_table.reduce(
    (s, r) => ({ share: s.share + r.weight_percentage, planned: s.planned + r.weighted_planned, actual: s.actual + r.weighted_actual }),
    { share: 0, planned: 0, actual: 0 }
  )
  const matches = (shown: number | null, value: number | null) => shown != null && value != null && Math.abs(shown - value) < 0.005
  const gap = data.actual_cum_percent != null && data.planned_cum_percent != null ? data.actual_cum_percent - data.planned_cum_percent : null
  const lag = data.pv_value != null && data.ev_value != null ? data.pv_value - data.ev_value : null

  if (data.status !== 'ok') {
    return (
      <div className="space-y-3">
        <Formula />
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{data.reason_fa}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-slate-800">الف) فرمول</h3>
        <Formula />
        <p className="text-[11px] leading-5 text-slate-500">
          W = {byWeight ? 'وزن زمان‌بندی فعالیت برگ (٪ از کل پروژه)' : 'بودجهٔ فعالیت (تومان) — هیچ فعالیتی وزن زمان‌بندی ندارد'} · P(برنامه) = سهم
          سپری‌شدهٔ بازهٔ مبنا تا تاریخ محاسبه (روز تقویمی) · P(واقعی) = درصد فیزیکی تأییدشده
          {data.as_of ? ` در ${jalaliDate(data.as_of)}` : ''}.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-slate-800">ب) جایگذاری اعداد</h3>
        {[
          { label: 'پیشرفت تجمعی واقعی', text: data.substitution_text },
          { label: 'پیشرفت تجمعی برنامه‌ای', text: data.substitution_planned_text },
        ].map((s) => (
          <div key={s.label}>
            <p className="mb-1 text-[11px] font-semibold text-slate-600">{s.label}</p>
            <p dir="ltr" className="max-h-28 overflow-y-auto rounded-xl bg-sky-50 px-3 py-2 text-left font-mono text-[11px] leading-5 text-slate-800 ring-1 ring-inset ring-sky-100">
              {s.text}
            </p>
          </div>
        ))}
        <p className="text-[11px] text-slate-500">وزن‌ها نرمال شده‌اند (Wᵢ ÷ ΣW)، پس مخرج ۱٫۰۰ است. ΣW واقعی = {faNumber(data.total_weight, 2)}.</p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="پیشرفت تجمعی واقعی" value={pct(data.actual_cum_percent)} highlight />
        <Stat label="پیشرفت تجمعی برنامه‌ای" value={pct(data.planned_cum_percent)} highlight />
        <Stat
          label="انحراف (واقعی − برنامه)"
          value={gap == null ? '—' : `${gap < 0 ? '−' : '+'}${faNumber(Math.abs(gap), 2)} واحد`}
          tone={gap != null && gap < -0.005 ? 'rose' : 'emerald'}
        />
        <Stat label="BAC (بودجهٔ کل)" value={data.bac_total > 0 ? toman(data.bac_total) : 'ثبت نشده'} />
        <Stat label="PV = BAC × Planned%" value={toman(data.pv_value)} />
        <Stat label="EV = BAC × Actual%" value={toman(data.ev_value)} />
      </section>
      {lag != null && Math.abs(lag) >= 1 ? (
        <p className="text-[11px] text-slate-500">
          EV Lag (PV − EV) = {toman(data.pv_value)} − {toman(data.ev_value)} = <strong className="text-slate-800">{toman(lag)}</strong>
        </p>
      ) : null}

      <section className="rounded-xl bg-amber-50/70 px-3 py-2 text-[13px] leading-7 text-slate-800 ring-1 ring-inset ring-amber-200">
        <span className="font-bold">تحلیل مدیریتی: </span>
        {data.interpretation_fa}
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-slate-800">ج) ریز محاسبه به تفکیک WBS ({faNumber(data.breakdown_table.length)} ردیف)</h3>
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:font-semibold">
                <th className="text-right">WBS</th>
                <th className="text-right">فعالیت</th>
                <th className="text-left">{byWeight ? 'وزن (W)' : 'بودجه (W)'}</th>
                <th className="text-left">سهم وزن</th>
                <th className="text-left">برنامه٪</th>
                <th className="text-left">واقعی٪</th>
                <th className="text-left">سهم برنامه</th>
                <th className="text-left">سهم واقعی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.breakdown_table.map((r) => (
                <tr key={r.activity_id} className="tabular-nums [&>td]:px-2 [&>td]:py-1.5 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap text-right text-slate-500" dir="ltr">{r.wbs_code}</td>
                  <td className="text-right text-slate-800">
                    {r.task_name}
                    {r.kind === 'package' ? <span className="ms-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">بسته</span> : null}
                    {r.actual_source === 'no_record' ? <span className="ms-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">بدون رکورد</span> : null}
                  </td>
                  <td className="text-left">{faNumber(r.weight, byWeight ? 2 : 0)}</td>
                  <td className="text-left text-slate-600">{pct(r.weight_percentage, 2)}</td>
                  <td className="text-left">{pct(r.planned_progress, 1)}</td>
                  <td className={cn('text-left', r.actual_progress + 0.05 < r.planned_progress ? 'text-rose-600' : 'text-slate-800')}>
                    {pct(r.actual_progress, 1)}
                  </td>
                  <td className="text-left text-slate-700">{faNumber(r.weighted_planned, 3)}</td>
                  <td className="text-left font-semibold text-slate-900">{faNumber(r.weighted_actual, 3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-orange-50 font-bold tabular-nums">
              <tr className="[&>td]:px-2 [&>td]:py-2">
                <td colSpan={2} className="text-right text-slate-800">جمع (= عدد نهایی)</td>
                <td className="text-left">{faNumber(data.total_weight, byWeight ? 2 : 0)}</td>
                <td className="text-left">{pct(totals.share, 2)}</td>
                <td />
                <td />
                <td className="text-left">
                  <span className="rounded-md bg-white px-1.5 py-0.5 ring-2 ring-slate-800">{pct(totals.planned)}</span>
                </td>
                <td className="text-left">
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-orange-700 ring-2 ring-orange-500">{pct(totals.actual)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] leading-5 text-slate-500">
          سهم هر ردیف = (Wᵢ ÷ ΣW) × Pᵢ؛ جمع ستون «سهم واقعی» همان پیشرفت تجمعی واقعی و جمع «سهم برنامه» همان پیشرفت تجمعی برنامه‌ای است.
        </p>
        {card.actual != null || card.planned != null ? (
          <p
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px]',
              matches(card.actual, data.actual_cum_percent) && matches(card.planned, data.planned_cum_percent)
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            )}
          >
            کارت داشبورد: واقعی {pct(card.actual)} · برنامه {pct(card.planned)} —{' '}
            {matches(card.actual, data.actual_cum_percent) && matches(card.planned, data.planned_cum_percent)
              ? 'دقیقاً برابر با جمع ستون‌های بالا.'
              : 'با تاریخ محاسبهٔ انتخاب‌شده متفاوت است (کارت همیشه امروز را نشان می‌دهد).'}
          </p>
        ) : null}
      </section>

      {data.warnings_fa.length ? (
        <section className="space-y-1">
          {data.warnings_fa.map((w) => (
            <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {w}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  )
}

/** «مشاهدهٔ فرآیند محاسبه و فرمول» — side sheet with the explained cumulative progress. */
export function CumulativeProgressSheet({
  projectId,
  today,
  card,
  onClose,
}: {
  projectId: string
  today: string
  card: { planned: number | null; actual: number | null }
  onClose: () => void
}) {
  const [asOf, setAsOf] = useState<string | null>(null)
  const load = useCumulativeProgress(projectId, asOf)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="فرآیند محاسبهٔ پیشرفت تجمعی"
        className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-left"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Calculator className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">فرآیند محاسبهٔ پیشرفت تجمعی</p>
            <p className="text-xs text-slate-500">برنامه‌ای و واقعی · میانگین وزنی ردیف‌به‌ردیف · مستقیم از وزن‌ها و پیشرفت ثبت‌شده</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            تاریخ محاسبه
            <input
              type="date"
              dir="ltr"
              max={today}
              value={asOf ?? today}
              onChange={(e) => setAsOf(e.target.value && e.target.value !== today ? e.target.value : null)}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400/60"
            />
          </label>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {load.state === 'loading' ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> در حال محاسبه…
            </p>
          ) : load.state === 'error' ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{load.message}</p>
          ) : (
            <Body data={load.data} card={asOf ? { planned: null, actual: null } : card} />
          )}
        </div>
      </div>
    </div>
  )
}
