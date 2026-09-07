'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Milestone } from 'lucide-react'
import { formatScheduleDate } from '@/lib/schedule/dates'
import type { MilestoneTrendSeriesDto } from '@/lib/schedule/schedule-alerts-api'
import { cn } from '@/lib/utils'

const COLORS = ['#ea580c', '#2563eb', '#059669', '#7c3aed', '#db2777', '#0891b2']

function formatTsTick(ts: number): string {
  if (!Number.isFinite(ts)) return ''
  return formatScheduleDate(new Date(ts).toISOString(), 'jalali')
}

export function MilestoneTrendPanel({
  projectId,
  refreshKey = 0,
}: {
  projectId: string
  refreshKey?: number
}) {
  const [series, setSeries] = useState<MilestoneTrendSeriesDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schedule/milestone-trend?projectId=${projectId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'بارگذاری روند مایلستون ناموفق بود')
      const next = (data.series ?? []) as MilestoneTrendSeriesDto[]
      setSeries(next)
      setSelectedId((prev) => {
        if (prev && next.some((s) => s.taskId === prev)) return prev
        return next[0]?.taskId ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const selected = useMemo(
    () => series.find((s) => s.taskId === selectedId) ?? series[0] ?? null,
    [series, selectedId]
  )

  const chartData = useMemo(() => {
    if (!selected) return []
    return selected.points.map((p) => ({
      calculationDate: p.calculationDate,
      label: p.calculationLabel,
      predictedTs: p.predictedTs,
      baselineTs: p.baselineTs,
      predictedLabel: p.predictedLabel,
    }))
  }, [selected])

  const yDomain = useMemo(() => {
    const values: number[] = []
    for (const p of chartData) {
      values.push(p.predictedTs)
      if (p.baselineTs != null) values.push(p.baselineTs)
    }
    if (values.length === 0) return ['auto', 'auto'] as const
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max(3 * 86400000, (max - min) * 0.1)
    return [min - pad, max + pad] as [number, number]
  }, [chartData])

  if (!projectId) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl" lang="fa">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Milestone className="h-4 w-4 text-orange-600" />
            Milestone Trend
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            محور افقی: تاریخ محاسبه · محور عمودی: تاریخ پیش‌بینی · خط افقی: baseline
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          بروزرسانی
        </button>
      </div>

      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {series.map((s, i) => (
            <button
              key={s.taskId}
              type="button"
              onClick={() => setSelectedId(s.taskId)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs transition-colors',
                selected?.taskId === s.taskId
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              )}
              style={
                selected?.taskId === s.taskId
                  ? undefined
                  : { borderColor: COLORS[i % COLORS.length] }
              }
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      ) : null}

      {loading && chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">در حال بارگذاری…</p>
      ) : !selected || chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          هنوز روند مایلستونی نیست — یک‌بار «محاسبه مسیر بحرانی» را اجرا کنید.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span>مایلستون: {selected.name}</span>
            {selected.baselineLabel ? (
              <span>
                Baseline: <strong>{selected.baselineLabel}</strong>
              </span>
            ) : (
              <span className="text-amber-700">Baseline هنوز ثبت نشده</span>
            )}
          </div>
          <div className="h-[260px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis
                  domain={yDomain as [number, number]}
                  tickFormatter={(v) => formatTsTick(Number(v))}
                  tick={{ fontSize: 10 }}
                  width={78}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(l) => `محاسبه: ${l}`}
                  formatter={(value, name) => {
                    if (name === 'predictedTs') {
                      return [formatTsTick(Number(value)), 'پیش‌بینی']
                    }
                    return [formatTsTick(Number(value)), String(name)]
                  }}
                />
                <Legend />
                {selected.baselineDate ? (
                  <ReferenceLine
                    y={new Date(`${selected.baselineDate}T12:00:00.000Z`).getTime()}
                    stroke="#64748b"
                    strokeDasharray="5 4"
                    label={{ value: 'Baseline', position: 'insideTopLeft', fontSize: 10 }}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="predictedTs"
                  name="پیش‌بینی"
                  stroke="#ea580c"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}
