/**
 * @file features/finance/components/workshop-cost-chart.tsx
 * @purpose کامپوننت UI — حسابداری، هزینه،overhead و صورت‌وضعیت (workshop-cost-chart)
 * @safe-to-edit CAREFUL
 * @affects حسابداری، هزینه،overhead و صورت‌وضعیت
 * @depends-on features/manager/lib/format, features/finance/lib/workshop-cost-curve, features/evm/lib/metrics
 */

'use client'

import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { jalaliDate, jalaliMonthLabel } from '@/features/manager/lib/format'
import type { CostCurvePoint } from '@/features/finance/lib/workshop-cost-curve'
import type { EvmBudgetBasis } from '@/features/evm/lib/metrics'
import { WORKSHOP_COST_CHART_COPY } from '@/features/finance/config'

const LAYERS = [
  { key: 'overhead', label: WORKSHOP_COST_CHART_COPY.layerOverhead, color: '#f59e0b' },
  { key: 'contractor', label: WORKSHOP_COST_CHART_COPY.layerContractor, color: '#14b8a6' },
  { key: 'purchases', label: WORKSHOP_COST_CHART_COPY.layerPurchases, color: '#6366f1' },
] as const

const LINES = [
  { key: 'planned', label: WORKSHOP_COST_CHART_COPY.linePlanned, color: '#1e3a8a', dash: undefined },
  { key: 'earned', label: WORKSHOP_COST_CHART_COPY.lineEarned, color: '#ea580c', dash: '5 4' },
] as const

const LABELS: Record<string, string> = Object.fromEntries(
  [...LAYERS, ...LINES, { key: 'total', label: WORKSHOP_COST_CHART_COPY.totalActual }].map((s) => [s.key, s.label])
)

function tsOf(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T12:00:00Z`)
}

function isoOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function toman(value: number): string {
  return WORKSHOP_COST_CHART_COPY.toman(Math.round(value).toLocaleString('en-US'))
}

function millions(value: number): string {
  return (value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: value >= 10_000_000 ? 0 : 1 })
}

const BUDGET_SOURCE: Partial<Record<EvmBudgetBasis, string>> = {
  technical_office_cost: WORKSHOP_COST_CHART_COPY.budgetTechnicalOffice,
  contract_value: WORKSHOP_COST_CHART_COPY.budgetContractValue,
  weighted_project_budget: WORKSHOP_COST_CHART_COPY.budgetWeighted,
}

export function WorkshopCostChart({
  points,
  budgetBasis,
}: {
  points: CostCurvePoint[]
  budgetBasis?: EvmBudgetBasis
}) {
  const data = useMemo(() => points.map((p) => ({ ...p, ts: tsOf(p.date) })), [points])
  const ticks = useMemo(() => {
    const seen = new Set<string>()
    return data.filter((p) => {
      const label = jalaliMonthLabel(p.date)
      if (seen.has(label)) return false
      seen.add(label)
      return true
    }).map((p) => p.ts)
  }, [data])
  const today = points.find((p) => p.isToday) ?? null
  const hasPlan = points.some((p) => p.planned != null)
  const bac = Math.max(0, ...points.map((p) => p.planned ?? 0))
  const budgetSource = budgetBasis ? BUDGET_SOURCE[budgetBasis] : undefined

  if (data.length === 0) {
    return <p className="p-5 text-sm text-slate-500">{WORKSHOP_COST_CHART_COPY.empty}</p>
  }

  return (
    <div className="space-y-3 p-5">
      <ul className="flex flex-wrap items-center gap-2" aria-label={WORKSHOP_COST_CHART_COPY.legendAria}>
        {LAYERS.map((s) => (
          <li
            key={s.key}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600"
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
            {today ? <strong className="tabular-nums text-slate-900">{toman(today[s.key] ?? 0)}</strong> : null}
          </li>
        ))}
        {hasPlan
          ? LINES.map((s) => (
              <li
                key={s.key}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600"
              >
                <svg width="18" height="8" aria-hidden>
                  <line x1="1" y1="4" x2="17" y2="4" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} strokeLinecap="round" />
                </svg>
                {s.label}
                {today?.[s.key] != null ? <strong className="tabular-nums text-slate-900">{toman(today[s.key]!)}</strong> : null}
              </li>
            ))
          : null}
      </ul>

      <figure className="relative h-[340px] w-full" aria-label={WORKSHOP_COST_CHART_COPY.figureAria}>
        <div className="absolute inset-0" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={(value: number) => jalaliMonthLabel(isoOf(value))}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                minTickGap={18}
              />
              <YAxis
                orientation="left"
                tickFormatter={(v) => millions(Number(v))}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={56}
                label={{ value: WORKSHOP_COST_CHART_COPY.yAxis, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
              />
              {today ? (
                <ReferenceLine
                  x={tsOf(today.date)}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  label={{ value: WORKSHOP_COST_CHART_COPY.today, position: 'top', fill: '#334155', fontSize: 11, fontWeight: 600 }}
                />
              ) : null}
              <Tooltip
                cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgb(226 232 240 / 0.8)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  direction: 'rtl',
                  textAlign: 'right',
                  lineHeight: 1.9,
                }}
                labelFormatter={(_value, payload) => {
                  const point = payload?.[0]?.payload as CostCurvePoint | undefined
                  if (!point?.date) return ''
                  const total = point.total != null ? WORKSHOP_COST_CHART_COPY.totalInTooltip(toman(point.total)) : ''
                  return `${point.isToday ? WORKSHOP_COST_CHART_COPY.todayPrefix : ''}${jalaliDate(point.date)}${total}`
                }}
                formatter={(value, name) => [value == null ? '—' : toman(Number(value)), LABELS[String(name)] ?? String(name)]}
              />
              {LAYERS.map((s) => (
                <Area
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  stackId="actual"
                  stroke={s.color}
                  strokeWidth={1.5}
                  fill={s.color}
                  fillOpacity={0.35}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
              {hasPlan
                ? LINES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2.5}
                      strokeDasharray={s.dash}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))
                : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <div className="space-y-1 text-[11px] leading-5 text-slate-500">
        <p>{WORKSHOP_COST_CHART_COPY.layersExplain}</p>
        {hasPlan ? (
          <p>
            {WORKSHOP_COST_CHART_COPY.planExplain(toman(bac), budgetSource ?? WORKSHOP_COST_CHART_COPY.scheduleFallback)}
            {budgetBasis === 'contract_value'
              ? WORKSHOP_COST_CHART_COPY.contractValueCaveat
              : WORKSHOP_COST_CHART_COPY.overBudgetCaveat}
          </p>
        ) : (
          <p>{WORKSHOP_COST_CHART_COPY.noBudget}</p>
        )}
      </div>
    </div>
  )
}
