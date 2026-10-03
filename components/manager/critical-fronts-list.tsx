'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Database, Wrench, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { faNumber, jalaliDate } from '@/lib/manager/format'
import type { CriticalFrontAction, ManagerCriticalDelay, ManagerCriticalDelays } from '@/lib/manager/overview-types'

const IMPORTANCE: Record<ManagerCriticalDelay['importance'], { label: string; cls: string }> = {
  negative_float: { label: 'شناوری منفی', cls: 'bg-rose-500/10 text-rose-700 ring-rose-600/15' },
  critical: { label: 'مسیر بحرانی (CPM)', cls: 'bg-orange-500/10 text-orange-700 ring-orange-600/15' },
  zero_float: { label: 'شناوری صفر', cls: 'bg-amber-500/10 text-amber-700 ring-amber-600/15' },
  baseline_delay: { label: 'تأخیر نسبت به baseline', cls: 'bg-slate-500/10 text-slate-700 ring-slate-600/15' },
}

const OWNER_FA: Record<CriticalFrontAction['owner_role'], string> = {
  PM: 'مدیر پروژه',
  Planner: 'برنامه‌ریز',
  SiteManager: 'سرپرست کارگاه',
  Procurement: 'تدارکات',
}

type Toast = { text: string; payload: CriticalFrontAction['payload'] }

function ProgressBars({ planned, actual }: { planned: number; actual: number }) {
  return (
    <div className="space-y-1" aria-label={`برنامه ${faNumber(planned, 0)}٪، واقعی ${faNumber(actual, 0)}٪`}>
      {[
        { label: 'برنامه', value: planned, cls: 'bg-blue-900/70' },
        { label: 'واقعی', value: actual, cls: actual + 0.05 < planned ? 'bg-rose-500' : 'bg-emerald-500' },
      ].map((bar) => (
        <div key={bar.label} className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="w-9 shrink-0">{bar.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" dir="ltr">
            <div className={cn('h-full rounded-full', bar.cls)} style={{ width: `${Math.min(100, Math.max(0, bar.value))}%` }} />
          </div>
          <span className="w-9 shrink-0 text-left font-semibold tabular-nums text-slate-700">{faNumber(bar.value, 0)}٪</span>
        </div>
      ))}
    </div>
  )
}

function FrontRow({ item, mode, onDraft }: { item: ManagerCriticalDelay; mode: ManagerCriticalDelays['mode']; onDraft: (a: CriticalFrontAction) => void }) {
  const [open, setOpen] = useState(false)
  const importance = IMPORTANCE[item.importance]
  const panelId = `front-actions-${item.id}`
  return (
    <li className="rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-slate-200">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-6 text-slate-800" title={item.name}>
            {item.wbs ? <span className="ms-1 text-[11px] font-medium text-slate-400 tabular-nums">{item.wbs}</span> : null}
            {item.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-slate-500">
            <span className={cn('rounded-full px-2 py-px font-semibold ring-1 ring-inset', importance.cls)}>{importance.label}</span>
            {mode === 'cpm' ? (
              <span className="tabular-nums">
                Total Float{' '}
                <strong className={cn('font-bold', (item.totalFloatDays ?? 0) < 0 ? 'text-rose-700' : 'text-slate-800')}>
                  {item.totalFloatDays == null ? '—' : `${item.totalFloatDays < 0 ? '−' : ''}${faNumber(Math.abs(item.totalFloatDays))} روز`}
                </strong>
              </span>
            ) : null}
            <span className="tabular-nums">
              {item.overdue ? `موعد مبنا ${jalaliDate(item.baselineFinish)} گذشته` : `پایان پیش‌بینی ${jalaliDate(item.forecastFinish)}`}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-lg font-black leading-6 tabular-nums text-rose-600">−{faNumber(item.delayDays)}</p>
          <p className="text-[10px] text-slate-400">روز تأخیر از baseline</p>
        </div>
      </div>

      <div className="mt-2">
        <ProgressBars planned={item.plannedPercent} actual={item.percent} />
        {item.percentFromPackages ? <p className="mt-0.5 text-[10px] text-slate-400">پیشرفت واقعی = میانگین وزنی بسته‌های کاری این فعالیت</p> : null}
      </div>

      <div className="mt-2 text-[11px] leading-5">
        {item.causes.length ? (
          <ul className="space-y-0.5">
            {item.causes.map((cause) => (
              <li key={cause.ref} className="flex items-start gap-1.5 text-slate-700">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', cause.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500')} aria-hidden />
                <span>
                  <span className="font-semibold">علت/مانع: </span>
                  {cause.label_fa}
                  {cause.since ? <span className="text-slate-400"> · از {jalaliDate(cause.since)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">علت یا مانعی برای این فعالیت ثبت نشده است.</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400">
          {item.contractor ? `پیمانکار: ${item.contractor}` : 'پیمانکار تخصیص نیافته'}
          {mode === 'cpm' ? ` · پیش‌نیاز ${faNumber(item.predecessorCount)} · پس‌نیاز ${faNumber(item.successorCount)}` : ''}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[11px] font-bold text-orange-800 transition-colors hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
        >
          <Wrench className="h-3.5 w-3.5" aria-hidden />
          اقدام
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </div>

      {open ? (
        <ul id={panelId} className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-2 ring-1 ring-inset ring-slate-200">
          {item.actions.map((action) => (
            <li key={action.kind}>
              <button
                type="button"
                onClick={() => onDraft(action)}
                className="w-full rounded-lg bg-white p-2 text-right ring-1 ring-inset ring-slate-200 transition-colors hover:ring-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  {action.label_fa}
                  {action.recommended ? (
                    <span className="rounded-full bg-orange-500/10 px-1.5 py-px text-[10px] font-semibold text-orange-700">پیشنهاد مبتنی بر داده</span>
                  ) : null}
                  <span className="ms-auto text-[10px] font-medium text-slate-400">{OWNER_FA[action.owner_role]}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-5 text-slate-600">{action.rationale_fa}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function CpmNotice({ cpm }: { cpm: ManagerCriticalDelays['cpm'] }) {
  if (cpm.status === 'ok') {
    return cpm.unlinkedCount > 0 ? (
      <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-5 text-amber-800">
        {faNumber(cpm.unlinkedCount)} فعالیت از {faNumber(cpm.activityCount)} هیچ رابطهٔ پیش‌نیازی ندارند؛ Total Float آن‌ها قابل اتکا نیست.
      </p>
    ) : null
  }
  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-700">
      <p className="flex items-center gap-1.5 font-bold text-slate-800">
        <Database className="h-3.5 w-3.5 text-slate-500" aria-hidden />
        داده ناقص (data_missing): CPM / Total Float
      </p>
      <p className="mt-0.5">{cpm.reason_fa}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-4">
        {cpm.missing.map((m) => (
          <li key={m.key}>
            <span className="font-semibold">{m.label_fa}:</span> {m.detail_fa}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CriticalFrontsList({ data }: { data: ManagerCriticalDelays }) {
  const [toast, setToast] = useState<Toast | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 10000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <>
      <CpmNotice cpm={data.cpm} />
      {data.items.length === 0 ? (
        <p className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 text-xs leading-6 text-emerald-800">
          {data.mode === 'cpm'
            ? 'همهٔ فعالیت‌های ناتمام مسیر بحرانی تا امروز در محدودهٔ برنامهٔ مبنا هستند.'
            : 'هیچ فعالیت ناتمامی از پایان برنامهٔ مبنا عقب نیست.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => (
            <FrontRow
              key={item.id}
              item={item}
              mode={data.mode}
              onDraft={(action) =>
                setToast({
                  text: `پیش‌نویس «${action.label_fa}» برای «${item.name}» آماده شد (مسئول: ${OWNER_FA[action.owner_role]}، موعد ${jalaliDate(action.payload.due_date)}). ثبت و ابلاغ با اتصال به سیستم دستورکار فعال می‌شود.`,
                  payload: action.payload,
                })
              }
            />
          ))}
        </ul>
      )}
      {data.total > data.items.length ? (
        <p className="mt-2 text-xs text-slate-500">{faNumber(data.total - data.items.length)} فعالیت تأخیردار دیگر در Gantt</p>
      ) : null}
      {data.causeSources.length ? (
        <p className="mt-2 text-[10px] leading-4 text-slate-400">منابع علت/مانع: {data.causeSources.join('، ')}</p>
      ) : null}
      {toast ? (
        <div role="status" aria-live="polite" className="mt-2 rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-800 ring-1 ring-inset ring-sky-200">
          <div className="flex items-start justify-between gap-2">
            <p>{toast.text}</p>
            <button type="button" onClick={() => setToast(null)} aria-label="بستن" className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer opacity-70">payload</summary>
            <pre dir="ltr" className="mt-1 max-h-48 overflow-auto text-left font-mono text-[10px]">{JSON.stringify(toast.payload, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </>
  )
}
