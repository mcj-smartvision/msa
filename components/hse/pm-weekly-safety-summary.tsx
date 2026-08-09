'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { FileBarChart, Shield } from 'lucide-react'
import { getPmWeeklySafetySummary } from '@/lib/hse/workflow-feed'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Weekly HSE digest for project manager — trends, not raw alert noise. */
export function PmWeeklySafetySummaryPanel({ className }: { className?: string }) {
  const summary = useMemo(() => getPmWeeklySafetySummary(), [])

  return (
    <section
      className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}
      dir="rtl"
      lang="fa"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold text-slate-900">{summary.weekLabel}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            برای مدیر پروژه: روند ایمنی هفته، نه بمباران هر هشدار خام.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/dashboard/hse/reports">
            <FileBarChart className="h-3.5 w-3.5" />
            گزارش کامل
          </Link>
        </Button>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="رخدادهای هفته" value={summary.totalIncidents} />
        <Stat label="تخلف تأییدشده" value={summary.confirmedViolations} tone="danger" />
        <Stat label="مثبت کاذب / ردشده" value={summary.falsePositives} />
        <Stat label="بحرانی باز" value={summary.criticalOpen} tone={summary.criticalOpen > 0 ? 'warn' : 'ok'} />
      </div>

      <div className="grid gap-3 border-t border-slate-100 px-4 py-3 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-500">زون‌های پرریسک هفته</p>
          {summary.topZones.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">داده‌ای نیست.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {summary.topZones.map((z) => (
                <li key={z.name} className="flex justify-between text-xs text-slate-700">
                  <span>{z.name}</span>
                  <span className="font-semibold tabular-nums">{z.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500">پیمانکاران با بیشترین مورد</p>
          {summary.topContractors.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">داده‌ای نیست.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {summary.topContractors.map((c) => (
                <li key={c.name} className="flex justify-between text-xs text-slate-700">
                  <span className="truncate pe-2">{c.name}</span>
                  <span className="font-semibold tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 px-4 py-3">
        <p className="text-[11px] font-semibold text-slate-500">
          جمع‌بندی · اقدامات اصلاحی باز: {summary.openCorrectiveActions}
        </p>
        {summary.narrative.map((line, i) => (
          <p key={i} className="text-xs leading-relaxed text-slate-700">
            {line}
          </p>
        ))}
        {summary.criticalOpen > 0 ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
            توجه فوری: موارد بحرانی باز هنوز در صف اقدام هستند — جزئیات در مرکز کنترل ایمنی.
          </p>
        ) : null}
        <Button type="button" size="sm" variant="secondary" asChild>
          <Link href="/dashboard/hse">باز کردن مرکز کنترل ایمنی</Link>
        </Button>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'danger' | 'warn' | 'ok'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-slate-50'

  return (
    <div className={cn('rounded-lg border px-3 py-2', toneClass)}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
