'use client'

import { useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { faPercent, jalaliDate, jalaliMonthLabel } from '@/lib/manager/format'
import type { ManagerCurve } from '@/lib/manager/overview-types'

type ChartRange = '6m' | '12m' | 'all'

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '6m', label: '۶ ماه' },
  { id: '12m', label: '۱۲ ماه' },
  { id: 'all', label: 'کل پروژه' },
]

/** Months of plan shown after today in the windowed ranges. */
const FORWARD_MONTHS = 3

const SERIES = [
  { key: 'planned', label: 'برنامه (PV)', color: '#1e3a8a', dash: undefined, width: 2.5, fill: 0.1 },
  { key: 'actual', label: 'واقعی تأییدشده', color: '#10b981', dash: undefined, width: 2.5, fill: 0.14 },
  { key: 'earned', label: 'ارزش کسب‌شده (EV)', color: '#fb923c', dash: '5 4', width: 2.5, fill: 0.1 },
] as const

type SeriesKey = (typeof SERIES)[number]['key']

interface ChartDotProps {
  cx?: number
  cy?: number
  index?: number
  payload?: { isToday?: boolean }
}

/** Only the "today" point gets a marker, with a soft pulsing halo. */
function renderDot(key: SeriesKey, color: string) {
  function ChartDot({ cx, cy, index, payload }: ChartDotProps) {
    const id = `${key}-${index ?? 0}`
    if (cx == null || cy == null || !payload?.isToday) return <g key={id} />
    return (
      <g key={id}>
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill={color}
          opacity={0.35}
          className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
        />
        <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5} />
      </g>
    )
  }
  return ChartDot
}

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10
}

export function ManagerProgressChart({ curve }: { curve: ManagerCurve }) {
  const [range, setRange] = useState<ChartRange>('12m')
  const sameLine = curve.budgetBasis === 'weighted_project_budget'

  const todayIndex = curve.points.findIndex((p) => p.isToday)
  const today = todayIndex >= 0 ? curve.points[todayIndex] : null

  const data = useMemo(() => {
    let slice = curve.points
    if (range !== 'all' && todayIndex >= 0) {
      const back = range === '6m' ? 5 : 11
      slice = curve.points.slice(Math.max(0, todayIndex - back), todayIndex + 1 + FORWARD_MONTHS)
    }
    return slice.map((p) => ({
      date: p.date,
      isToday: p.isToday,
      planned: round1(p.planned),
      actual: round1(p.actual),
      earned: round1(p.earned),
    }))
  }, [curve.points, range, todayIndex])

  const visible = SERIES.filter((s) => !(sameLine && s.key === 'actual' && today?.actual != null && today.earned != null && Math.abs(today.actual - today.earned) < 0.05))

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-2" aria-label="راهنمای نمودار و مقادیر امروز">
          {visible.map((s) => (
            <li
              key={s.key}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600 shadow-xs"
            >
              <svg width="18" height="8" aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="17"
                  y2="4"
                  stroke={s.color}
                  strokeWidth={s.width + 0.5}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                />
              </svg>
              {s.label}
              {today ? (
                <strong className="text-[13px] font-bold tabular-nums text-slate-900">
                  {today[s.key as SeriesKey] != null ? faPercent(today[s.key as SeriesKey] as number) : '—'}
                </strong>
              ) : null}
            </li>
          ))}
        </ul>
        <div role="radiogroup" aria-label="بازهٔ نمودار" className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={range === option.id}
              onClick={() => setRange(option.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                range === option.id
                  ? 'bg-white font-semibold text-slate-900 shadow-xs ring-1 ring-slate-200/70'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <figure
        className="relative min-h-[300px] w-full flex-1"
        aria-label={
          today
            ? `منحنی S پیشرفت؛ امروز برنامه ${faPercent(today.planned)}، واقعی ${today.actual != null ? faPercent(today.actual) : 'ثبت نشده'}، ارزش کسب‌شده ${today.earned != null ? faPercent(today.earned) : 'ثبت نشده'}. زمان از چپ به راست.`
            : 'منحنی S پیشرفت پروژه؛ زمان از چپ به راست'
        }
      >
        <div className="absolute inset-0" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 24, right: 28, left: 8, bottom: 0 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`manager-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={s.fill} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => jalaliMonthLabel(value)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                minTickGap={18}
              />
              <YAxis
                orientation="left"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => faPercent(Number(v), 0)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              {today ? (
                <ReferenceLine
                  x={today.date}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  label={{ value: 'امروز', position: 'top', fill: '#334155', fontSize: 11, fontWeight: 600 }}
                />
              ) : null}
              <Tooltip
                cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgb(226 232 240 / 0.8)',
                  boxShadow: '0 8px 24px -6px rgb(15 23 42 / 0.12)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  direction: 'rtl',
                  textAlign: 'right',
                  lineHeight: 1.9,
                  padding: '8px 12px',
                }}
                labelStyle={{ fontWeight: 700, color: '#0f172a', marginBottom: 2 }}
                labelFormatter={(value: string, payload) => {
                  const point = payload?.[0]?.payload as { isToday?: boolean } | undefined
                  return point?.isToday ? `امروز — ${jalaliDate(value)}` : `پایان ${jalaliMonthLabel(value)}`
                }}
                formatter={(value, name) => {
                  const series = SERIES.find((s) => s.key === name)
                  return [value == null ? 'ثبت نشده' : faPercent(Number(value)), series?.label ?? String(name)]
                }}
              />
              {visible.map((s) => (
                <Area
                  key={`area-${s.key}`}
                  type="monotone"
                  dataKey={s.key}
                  stroke="none"
                  fill={`url(#manager-fill-${s.key})`}
                  isAnimationActive={false}
                  tooltipType="none"
                  legendType="none"
                  activeDot={false}
                  connectNulls={false}
                />
              ))}
              {visible.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={s.width}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={renderDot(s.key, s.color)}
                  activeDot={{ r: 5.5, strokeWidth: 2, stroke: '#fff', fill: s.color }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <div className="space-y-1 text-[11px] leading-5 text-slate-500">
        {!curve.hasHistory ? (
          <p>
            تاریخچهٔ ماهانهٔ پیشرفت هنوز ذخیره نشده است؛ برای «واقعی» و «EV» فقط نقطهٔ امروز رسم شده و خطی
            حدسی کشیده نمی‌شود.
          </p>
        ) : null}
        {sameLine && visible.length < SERIES.length ? (
          <p>بودجهٔ این پروژه به نسبت وزن فعالیت‌ها پخش شده، به همین دلیل پیشرفت واقعی و EV یکسان‌اند و یک خط نمایش داده می‌شود.</p>
        ) : null}
        <p>
          برنامه = PV ÷ BAC طبق baseline · EV = ارزش کار تأییدشده ÷ BAC · محور افقی ماه شمسی (از چپ به راست) · مقادیر امروز
          دقیقاً همان کارت‌های بالای صفحه‌اند.
        </p>
      </div>
    </div>
  )
}
