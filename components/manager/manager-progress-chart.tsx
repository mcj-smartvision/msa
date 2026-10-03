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
import { faNumber, faPercent, jalaliDate, jalaliMonthLabel } from '@/lib/manager/format'
import type { ManagerCurve } from '@/lib/manager/overview-types'
import type { EvForecast } from '@/lib/project-controls/ev-forecast'

type ChartRange = '1m' | '6m' | '12m' | 'all'

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '1m', label: '۱ ماه اخیر' },
  { id: '6m', label: '۶ ماه' },
  { id: '12m', label: '۱۲ ماه' },
  { id: 'all', label: 'کل پروژه' },
]

/** Months of plan shown after today in the windowed ranges. */
const FORWARD_MONTHS = 3

/** Recorded history shorter than this opens on the one-month range, where its points are readable. */
const RECENT_HISTORY_DAYS = 45

const SERIES = [
  { key: 'planned', label: 'برنامه (PV)', color: '#1e3a8a', dash: undefined, width: 2.5, fill: 0.1 },
  { key: 'actual', label: 'واقعی ثبت‌شده', color: '#10b981', dash: undefined, width: 2.5, fill: 0.14 },
  { key: 'earned', label: 'ارزش کسب‌شده (EV)', color: '#fb923c', dash: '5 4', width: 2.5, fill: 0.1 },
] as const

const FORECAST = { key: 'forecast', label: 'پیش‌بینی EV', color: '#c2410c', dash: '2 5' } as const

type SeriesKey = (typeof SERIES)[number]['key'] | typeof FORECAST.key

interface ChartDotProps {
  cx?: number
  cy?: number
  index?: number
  payload?: { isToday?: boolean; kind?: string }
  value?: number | null
}

/** "Today" gets a marker with a soft pulsing halo; recorded report days get a small dot on actual / EV. */
function renderDot(key: SeriesKey, color: string) {
  function ChartDot({ cx, cy, index, payload, value }: ChartDotProps) {
    const id = `${key}-${index ?? 0}`
    if (cx == null || cy == null || value == null) return <g key={id} />
    if (key === FORECAST.key) {
      return payload?.kind === 'forecast' ? (
        <circle key={id} cx={cx} cy={cy} r={4} fill="#fff" stroke={color} strokeWidth={2} />
      ) : (
        <g key={id} />
      )
    }
    if (!payload?.isToday) {
      return payload?.kind === 'record' && key !== 'planned' ? (
        <circle key={id} cx={cx} cy={cy} r={3} fill="#fff" stroke={color} strokeWidth={2} />
      ) : (
        <g key={id} />
      )
    }
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

const DAY_MS = 86_400_000

function tsOf(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T12:00:00Z`)
}

function isoOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function ForecastPanel({ forecast }: { forecast: EvForecast }) {
  if (forecast.status !== 'ok') {
    return (
      <aside className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-xs leading-6 text-slate-600 lg:w-60">
        <p className="font-semibold text-slate-700">پیش‌بینی رسم نشد</p>
        <p>{forecast.reason_fa}</p>
      </aside>
    )
  }
  const unitFa = forecast.periodUnit === 'months' ? 'ماه' : forecast.periodUnit === 'weeks' ? 'هفته' : 'روز'
  const late = forecast.delayDays > 0
  const rows: { label: string; value: string }[] = [
    { label: 'پایان مبنا (Baseline)', value: jalaliDate(forecast.baselineFinish) },
    {
      label: 'DelayDays',
      value: forecast.delayDays === 0 ? 'بدون تأخیر' : `${faNumber(Math.abs(forecast.delayDays))} روز ${late ? 'تأخیر' : 'جلوتر'}`,
    },
    { label: 'SPI(t) = ES ÷ AT', value: faNumber(forecast.spiT, 3) },
    { label: 'EAC(t) = PD ÷ SPI(t)', value: `${faNumber(forecast.eacT, 2)} ${unitFa}` },
  ]
  return (
    <aside
      className="rounded-2xl border border-orange-200/80 bg-orange-50/60 p-3 text-xs leading-6 text-slate-600 lg:w-60"
      aria-label="پیش‌بینی تاریخ پایان"
    >
      <p className="text-slate-500">تاریخ پایان پیش‌بینی‌شده</p>
      <p className={cn('text-lg font-bold tabular-nums', late ? 'text-orange-700' : 'text-emerald-700')}>
        {jalaliDate(forecast.finishDate)}
      </p>
      <dl className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-500" dir="ltr">{row.label}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t border-orange-200/70 pt-2 text-[11px] leading-5 text-slate-500">
        پایان = پایان مبنا + DelayDays. خط‌چین: EV(d) = PV مبنا در (ES + Δt × SPI(t))؛ یعنی کار باقی‌مانده با همان کارایی زمانی
        امروز پیش می‌رود. نقطهٔ شروع، EV امروز است و هیچ نقطه‌ای خارج از snapshot ساخته نمی‌شود.
      </p>
    </aside>
  )
}

export function ManagerProgressChart({ curve }: { curve: ManagerCurve }) {
  const todayIndex = curve.points.findIndex((p) => p.isToday)
  const today = todayIndex >= 0 ? curve.points[todayIndex] : null
  const recentHistory =
    today != null && curve.historyStart != null && tsOf(today.date) - tsOf(curve.historyStart) <= RECENT_HISTORY_DAYS * DAY_MS
  const forecast = curve.forecast
  const [range, setRange] = useState<ChartRange>(recentHistory && forecast.status !== 'ok' ? '1m' : '12m')
  const sameLine = curve.budgetBasis === 'weighted_project_budget'

  const data = useMemo(() => {
    let slice = curve.points
    if (range === '1m' && today) {
      const from = tsOf(today.date) - 31 * DAY_MS
      const to = tsOf(today.date) + 10 * DAY_MS
      slice = curve.points.filter((p) => tsOf(p.date) >= from && tsOf(p.date) <= to)
    } else if (range !== 'all' && today) {
      const back = range === '6m' ? 6 : 12
      const from = tsOf(today.date) - back * 30.5 * DAY_MS
      const planTo = tsOf(today.date) + (FORWARD_MONTHS * 30.5 + 1) * DAY_MS
      const to = forecast.status === 'ok' ? Math.max(planTo, tsOf(forecast.finishDate)) : planTo
      slice = curve.points.filter((p) => tsOf(p.date) >= from && tsOf(p.date) <= to)
    }
    return slice.map((p) => ({
      ts: tsOf(p.date),
      date: p.date,
      isToday: p.isToday,
      kind: p.kind,
      planned: round1(p.planned),
      actual: round1(p.actual),
      earned: round1(p.earned),
      forecast: round1(p.forecast ?? null),
    }))
  }, [curve.points, range, today, forecast])
  const ticks = useMemo(
    () => (range === '1m' ? data.map((p) => p.ts) : data.filter((p) => p.kind === 'month').map((p) => p.ts)),
    [data, range]
  )

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
          {forecast.status === 'ok' ? (
            <li className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-600 shadow-xs">
              <svg width="18" height="8" aria-hidden>
                <line x1="1" y1="4" x2="17" y2="4" stroke={FORECAST.color} strokeWidth={2.5} strokeDasharray={FORECAST.dash} strokeLinecap="round" />
              </svg>
              {FORECAST.label}
              <strong className="text-[13px] font-bold tabular-nums text-slate-900">{jalaliDate(forecast.finishDate)}</strong>
            </li>
          ) : null}
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

      <div className="flex flex-1 flex-col gap-3 lg:flex-row-reverse">
      <ForecastPanel forecast={forecast} />
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
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={(value: number) =>
                  range === '1m' ? jalaliDate(isoOf(value)).slice(5) : jalaliMonthLabel(isoOf(value))
                }
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
                  x={tsOf(today.date)}
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
                labelFormatter={(_value, payload) => {
                  const point = payload?.[0]?.payload as { date?: string; kind?: string } | undefined
                  if (!point?.date) return ''
                  if (point.kind === 'today') return `امروز — ${jalaliDate(point.date)}`
                  if (point.kind === 'record') return `گزارش ${jalaliDate(point.date)}`
                  if (point.kind === 'forecast') return `پایان پیش‌بینی‌شده — ${jalaliDate(point.date)}`
                  return `پایان ${jalaliMonthLabel(point.date)}`
                }}
                formatter={(value, name) => {
                  const label = name === FORECAST.key ? FORECAST.label : SERIES.find((s) => s.key === name)?.label
                  return [value == null ? 'ثبت نشده' : faPercent(Number(value)), label ?? String(name)]
                }}
              />
              {forecast.status === 'ok' ? (
                <ReferenceLine
                  x={tsOf(forecast.finishDate)}
                  stroke={FORECAST.color}
                  strokeOpacity={0.5}
                  strokeDasharray="2 4"
                  label={{ value: 'پایان پیش‌بینی', position: 'insideTopLeft', fill: FORECAST.color, fontSize: 11, fontWeight: 600 }}
                />
              ) : null}
              {visible.map((s) => (
                <Area
                  key={`area-${s.key}`}
                  type={s.key === 'planned' ? 'monotone' : 'linear'}
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
                  type={s.key === 'planned' ? 'monotone' : 'linear'}
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
              {forecast.status === 'ok' ? (
                <Line
                  type="linear"
                  dataKey={FORECAST.key}
                  stroke={FORECAST.color}
                  strokeWidth={2}
                  strokeDasharray={FORECAST.dash}
                  strokeLinecap="round"
                  dot={renderDot(FORECAST.key, FORECAST.color)}
                  activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: FORECAST.color }}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
      </div>

      <div className="space-y-1 text-[11px] leading-5 text-slate-500">
        {!curve.hasHistory ? (
          <p>
            تاریخچهٔ پیشرفت هنوز ثبت نشده است؛ برای «واقعی» و «EV» فقط نقطهٔ امروز رسم شده و خطی حدسی کشیده نمی‌شود.
          </p>
        ) : curve.historyStart ? (
          <p>
            خط «واقعی» و «EV» از گزارش‌های ثبت‌شدهٔ پیشرفت ساخته شده و از اولین گزارش ({jalaliDate(curve.historyStart)}) تا امروز
            رسم می‌شود؛ پیش از آن گزارشی ثبت نشده و خطی حدس زده نمی‌شود.
          </p>
        ) : null}
        {forecast.status === 'ok' && range === '1m' ? (
          <p>خط‌چین پیش‌بینی EV تا {jalaliDate(forecast.finishDate)} ادامه دارد؛ برای دیدن کامل آن بازهٔ ۱۲ ماه یا کل پروژه را انتخاب کنید.</p>
        ) : null}
        {sameLine && visible.length < SERIES.length ? (
          <p>بودجهٔ این پروژه به نسبت وزن فعالیت‌ها پخش شده، به همین دلیل پیشرفت واقعی و EV یکسان‌اند و یک خط نمایش داده می‌شود.</p>
        ) : null}
        <p>
          برنامه = میانگین وزنی درصد برنامه طبق baseline · EV = میانگین وزنی پیشرفت تأییدشده (وزن زمان‌بندی) · محور افقی ماه شمسی (از چپ به راست) · مقادیر امروز
          دقیقاً همان کارت‌های بالای صفحه‌اند.
        </p>
      </div>
    </div>
  )
}
