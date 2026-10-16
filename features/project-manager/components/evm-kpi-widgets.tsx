/**
 * @file features/project-manager/components/evm-kpi-widgets.tsx
 * @purpose کامپوننت UI — اتاق فرمان مدیر پروژه و کارتابل (evm-kpi-widgets)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on shared/lib/utils, features/evm/lib/metrics, features/evm/lib/rag-status, features/project-manager/config
 */

'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import type { EvmCostSource, EvmMetrics } from '@/features/evm/lib/metrics'
import { DEFAULT_RAG_THRESHOLDS, type FloatHealth } from '@/features/evm/lib/rag-status'
import { EVM_KPI_COPY } from '@/features/project-manager/config'

const C = EVM_KPI_COPY

const COST_SOURCE_LABEL: Record<EvmCostSource, string> = C.costSource

const BUDGET_BASIS_LABEL: Record<EvmMetrics['budgetBasis'], string> = C.budgetBasis

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Left-to-right isolate keeps the sign and digit grouping intact inside Persian text. */
function formatToman(value: number): string {
  return `\u2066${formatAmount(value)}\u2069 ${C.toman}`
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

export function EvmKpiWidgets({
  metrics,
  float,
  scheduleCard,
}: {
  metrics: EvmMetrics
  float: FloatHealth
  /** The schedule card (SPI(t) primary, SPI secondary) rendered by the explainable engine. */
  scheduleCard: ReactNode
}) {
  const acHelp = (Object.keys(COST_SOURCE_LABEL) as EvmCostSource[])
    .map((key) => `${COST_SOURCE_LABEL[key]}: ${formatToman(metrics.acBySource[key])}`)
    .join('\n')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scheduleCard}
        <KpiCard
          title={C.cpiTitle}
          value={metrics.cpi == null ? '—' : metrics.cpi.toFixed(2)}
          valueClassName={indexTone(metrics.cpi)}
          caption={metrics.cpi == null ? C.cpiMissing : C.cpiCaption}
          help={C.cpiHelp}
        />
        <KpiCard
          title={C.earnedTitle}
          value={`${metrics.earnedPercent.toFixed(1)}%`}
          caption={C.earnedCaption(
            metrics.plannedPercent.toFixed(1),
            metrics.activityCount,
            metrics.progressBasis === 'schedule_weight' ? C.weighted : C.budgeted
          )}
          help={C.earnedHelp}
        />
        <KpiCard
          title={C.floatTitle}
          value={float.criticalFloatDays == null ? '—' : String(Math.round(float.criticalFloatDays))}
          unit={float.criticalFloatDays == null ? undefined : C.days}
          valueClassName={
            float.criticalFloatDays != null && float.criticalFloatDays < 0 ? 'text-red-600' : undefined
          }
          caption={
            float.floatConsumptionPercent == null
              ? C.floatHistoryMissing
              : C.maxFloatConsumption(Math.round(float.floatConsumptionPercent))
          }
          help={C.floatHelp}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          title={C.pvTitle}
          value={formatAmount(metrics.pv)}
          unit={C.toman}
          valueClassName="text-lg"
          caption={C.fromBac(formatToman(metrics.bac))}
        />
        <KpiCard
          title={C.evTitle}
          value={formatAmount(metrics.ev)}
          unit={C.toman}
          valueClassName="text-lg"
          caption={C.svCaption(formatToman(metrics.sv))}
        />
        <KpiCard
          title={C.acTitle}
          value={formatAmount(metrics.ac)}
          unit={C.toman}
          valueClassName="text-lg"
          caption={C.cvCaption(formatToman(metrics.cv))}
          help={acHelp}
        />
      </div>

      <p className="text-xs text-slate-500">{BUDGET_BASIS_LABEL[metrics.budgetBasis]}</p>
    </div>
  )
}
