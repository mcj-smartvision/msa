'use client'

import { cn } from '@/lib/utils'
import type { EvmCostSource, EvmMetrics } from '@/lib/evm/metrics'
import { DEFAULT_RAG_THRESHOLDS, type FloatHealth } from '@/lib/evm/ragStatus'

const COST_SOURCE_LABEL: Record<EvmCostSource, string> = {
  expense: 'اسناد هزینه نهایی‌شده',
  vendor_bill: 'صورت‌حساب تأمین‌کنندگان',
  overhead: 'هزینه بالاسری کارگاه',
}

const BUDGET_BASIS_LABEL: Record<EvmMetrics['budgetBasis'], string> = {
  contract_value: 'بودجه = مقدار × قیمت واحد فعالیت‌ها',
  weighted_project_budget: 'بودجه پروژه به نسبت وزن فعالیت‌ها تقسیم شده',
  none: 'بودجه‌ای برای فعالیت‌ها ثبت نشده است',
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Left-to-right isolate keeps the sign and digit grouping intact inside Persian text. */
function formatToman(value: number): string {
  return `\u2066${formatAmount(value)}\u2069 تومان`
}

function indexTone(value: number | null): string {
  if (value == null) return 'text-slate-400'
  if (value < DEFAULT_RAG_THRESHOLDS.critical) return 'text-red-600'
  if (value < DEFAULT_RAG_THRESHOLDS.onTrack) return 'text-amber-600'
  return 'text-emerald-600'
}

function KpiCard({
  title,
  value,
  unit,
  valueClassName,
  caption,
  help,
}: {
  title: string
  value: string
  unit?: string
  valueClassName?: string
  caption?: string
  help?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" title={help}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className={cn('mt-1.5 text-2xl font-bold text-slate-900', valueClassName)}>
        <span className="tabular-nums" dir="ltr">
          {value}
        </span>
        {unit ? <span className="ms-1.5 text-sm font-medium text-slate-500">{unit}</span> : null}
      </p>
      {caption ? <p className="mt-1 text-xs leading-5 text-slate-500">{caption}</p> : null}
    </div>
  )
}

export function EvmKpiWidgets({ metrics, float }: { metrics: EvmMetrics; float: FloatHealth }) {
  const acHelp = (Object.keys(COST_SOURCE_LABEL) as EvmCostSource[])
    .map((key) => `${COST_SOURCE_LABEL[key]}: ${formatToman(metrics.acBySource[key])}`)
    .join('\n')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="SPI — شاخص عملکرد زمانی"
          value={metrics.spi == null ? '—' : metrics.spi.toFixed(2)}
          valueClassName={indexTone(metrics.spi)}
          caption={metrics.spi == null ? 'ارزش برنامه‌ای هنوز صفر است' : 'EV ÷ PV'}
          help="نسبت ارزش کسب‌شده به ارزش برنامه‌ای؛ کمتر از ۱ یعنی عقب‌تر از برنامه."
        />
        <KpiCard
          title="CPI — شاخص عملکرد هزینه"
          value={metrics.cpi == null ? '—' : metrics.cpi.toFixed(2)}
          valueClassName={indexTone(metrics.cpi)}
          caption={metrics.cpi == null ? 'هزینهٔ واقعی ثبت نشده است' : 'EV ÷ AC'}
          help="نسبت ارزش کسب‌شده به هزینهٔ واقعی؛ کمتر از ۱ یعنی بیش از بودجه خرج شده."
        />
        <KpiCard
          title="پیشرفت واقعی (کسب‌شده)"
          value={`${metrics.earnedPercent.toFixed(1)}%`}
          caption={`برنامه‌ای: ${metrics.plannedPercent.toFixed(1)}٪ · ${metrics.activityCount} فعالیت بودجه‌دار`}
          help="درصد کسب‌شده طبق پیشرفت فیزیکی تأییدشدهٔ دفتر فنی و درصد برنامه‌ای طبق baseline برنامه MSP."
        />
        <KpiCard
          title="شناوری مسیر بحرانی"
          value={float.criticalFloatDays == null ? '—' : String(Math.round(float.criticalFloatDays))}
          unit={float.criticalFloatDays == null ? undefined : 'روز'}
          valueClassName={
            float.criticalFloatDays != null && float.criticalFloatDays < 0 ? 'text-red-600' : undefined
          }
          caption={
            float.floatConsumptionPercent == null
              ? 'تاریخچهٔ شناوری ثبت نشده'
              : `بیشترین مصرف شناوری: ${Math.round(float.floatConsumptionPercent)}٪`
          }
          help="کمترین شناوری کل در فعالیت‌های بحرانی طبق آخرین محاسبهٔ CPM."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          title="PV — ارزش برنامه‌ای"
          value={formatAmount(metrics.pv)}
          unit="تومان"
          valueClassName="text-lg"
          caption={`از بودجهٔ کل ${formatToman(metrics.bac)}`}
        />
        <KpiCard
          title="EV — ارزش کسب‌شده"
          value={formatAmount(metrics.ev)}
          unit="تومان"
          valueClassName="text-lg"
          caption={`انحراف زمانی (SV): ${formatToman(metrics.sv)}`}
        />
        <KpiCard
          title="AC — هزینهٔ واقعی"
          value={formatAmount(metrics.ac)}
          unit="تومان"
          valueClassName="text-lg"
          caption={`انحراف هزینه (CV): ${formatToman(metrics.cv)}`}
          help={acHelp}
        />
      </div>

      <p className="text-xs text-slate-500">{BUDGET_BASIS_LABEL[metrics.budgetBasis]}</p>
    </div>
  )
}
