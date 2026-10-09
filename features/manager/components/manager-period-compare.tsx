'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
CartesianGrid,
ComposedChart,
Line,
ReferenceLine,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from 'recharts'
import { AlertTriangle, BarChart3, ChevronLeft, CircleDashed, RefreshCw, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber } from '@/features/manager/lib/format'
import type {
ComparisonCause,
ComparisonChartPoint,
ComparisonMetric,
ComparisonPointDetail,
ComparisonValue,
ComparisonVerdict,
ManagerPeriod,
PeriodComparison,
} from '@/features/manager/lib/overview-types'
import { EmptyNote, InfoHint, LoadingRows, SectionCard, Spinner } from './manager-ui'

const COLORS = { current: '#d9601a', previous: '#2f6fed', planned: '#111827' } as const

const PERIOD_WORDS: Record<ManagerPeriod, { current: string; previous: string }> = {
  today: { current: 'امروز', previous: 'دیروز' },
  week: { current: 'این هفته', previous: 'هفتهٔ قبل' },
  month: { current: 'این ماه', previous: 'ماه قبل' },
}

const UNIT_DIGITS: Record<ComparisonMetric['unit'], number> = { points: 1, index: 2, people: 1, count: 0 }

/** Value that fills a comparison bar when the metric has no `scaleMax`: 100% for progress, 1.0 for SPI. */
const BAR_FULL_SCALE: Partial<Record<ComparisonMetric['unit'], number>> = { points: 100, index: 1 }

const VERDICT_STYLE: Record<ComparisonVerdict, string> = {
  better: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  worse: 'bg-rose-50 text-rose-700 ring-rose-200',
  same: 'bg-slate-100 text-slate-600 ring-slate-200',
  neutral: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const CAUSE_SOURCE_LABELS: Record<ComparisonCause['source'], string> = {
  daily_report: 'گزارش روزانه',
  workshop: 'ثبت کارگاه',
  site_plan: 'برنامهٔ روزانهٔ کارگاه',
}

function formatValue(metric: Pick<ComparisonMetric, 'unit'>, value: number): string {
  const text = faNumber(value, UNIT_DIGITS[metric.unit])
  return metric.unit === 'points' ? `${text}٪` : text
}

/** `text` must be the formatted absolute value. */
function signed(text: string, value: number): string {
  if (value > 0) return `+${text}`
  if (value < 0) return `−${text}`
  return text
}

function tehranDateTime(iso: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { timeZone: 'Asia/Tehran', ...options }).format(date)
}

function usePeriodComparison(projectId: string | null, period: ManagerPeriod, refreshKey: string | null) {
  const [data, setData] = useState<PeriodComparison | null>(null)
  const [loading, setLoading] = useState(Boolean(projectId))
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!projectId) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/manager/period-comparison?projectId=${encodeURIComponent(projectId)}&period=${period}`,
        { cache: 'no-store' }
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'بارگذاری مقایسهٔ دوره‌ای ناموفق بود')
      if (id !== requestId.current) return
      setData(body as PeriodComparison)
    } catch (loadError) {
      if (id !== requestId.current) return
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری مقایسهٔ دوره‌ای ناموفق بود')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [projectId, period])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  const firstKey = useRef(refreshKey)
  useEffect(() => {
    if (refreshKey === firstKey.current) return
    firstKey.current = refreshKey
    void load()
  }, [refreshKey, load])

  return { data, loading, error, reload: load }
}

export function ManagerPeriodCompare({
  projectId,
  period,
  refreshKey,
  reportOpen = false,
  onReportClose,
  showSection = true,
}: {
  projectId: string | null
  period: ManagerPeriod
  /** Changes when the dashboard reloads, so this panel refreshes with it. */
  refreshKey: string | null
  /** Full-period report window, opened from the header period switcher. */
  reportOpen?: boolean
  onReportClose?: () => void
  /** When false only the report window and details panel render, without the inline section. */
  showSection?: boolean
}) {
  const { data, loading, error, reload } = usePeriodComparison(projectId, period, refreshKey)
  const [detail, setDetail] = useState<{ metricKey: ComparisonMetric['key'] | null } | null>(null)
  const words = PERIOD_WORDS[period]
  const stale = data != null && data.period !== period

  return (
    <>
    {reportOpen && onReportClose ? (
      <PeriodReportDialog
        period={period}
        data={stale ? null : data}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        onClose={onReportClose}
        onOpenDetail={(metricKey) => setDetail({ metricKey })}
      />
    ) : null}
    {showSection ? (
    <SectionCard
      title="مقایسهٔ عملکرد دوره‌ای"
      icon={<BarChart3 className="h-4 w-4" aria-hidden />}
      hint={
        <>
          هر بازه با همان مقدار زمان سپری‌شده از بازهٔ قبل مقایسه می‌شود (مثلاً امروز تا همین ساعت در برابر دیروز تا همان
          ساعت). رنگ سبز یعنی بهتر و قرمز یعنی بدتر، نه صرفاً افزایش یا کاهش. شاخصی که داده‌اش ثبت نشده خاکستری است و در
          شمارش حساب نمی‌شود.
        </>
      }
      action={loading && data ? <Spinner className="text-slate-400" /> : null}
    >
      {!projectId ? (
        <EmptyNote title="پروژه‌ای انتخاب نشده است" />
      ) : error && !data ? (
        <div className="space-y-3">
          <EmptyNote tone="error" title="بارگذاری مقایسهٔ دوره‌ای ناموفق بود" description={error} />
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            تلاش دوباره
          </button>
        </div>
      ) : !data || stale ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="flex flex-col gap-4">
          <SummaryLine data={data} words={words} />
          {data.warnings.length > 0 ? (
            <ul className="space-y-1.5" aria-label="هشدارهای داده">
              {data.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-6 text-amber-900"
                >
                  <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {data.metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                words={words}
                onOpen={() => setDetail({ metricKey: metric.key })}
              />
            ))}
          </div>
          <CompareChart data={data} words={words} onOpen={() => setDetail({ metricKey: null })} />
        </div>
      )}
    </SectionCard>
    ) : null}
    {detail && data && !stale ? (
      <DetailsPanel data={data} words={words} metricKey={detail.metricKey} onClose={() => setDetail(null)} />
    ) : null}
    </>
  )
}

const PERIOD_REPORT_TITLES: Record<ManagerPeriod, string> = {
  today: 'گزارش امروز',
  week: 'گزارش هفتهٔ جاری',
  month: 'گزارش ماه جاری',
}

interface ActivityProgressRow {
  name: string
  current: number | null
  previous: number | null
}

/** Weighted progress per activity summed over the chart buckets of each window. */
function activityProgressRows(data: PeriodComparison): ActivityProgressRow[] {
  if (data.chart.status !== 'ok') return []
  const rows = new Map<string, ActivityProgressRow>()
  const add = (name: string, side: 'current' | 'previous', delta: number) => {
    const row = rows.get(name) ?? { name, current: null, previous: null }
    row[side] = (row[side] ?? 0) + delta
    rows.set(name, row)
  }
  for (const point of data.chart.data.points) {
    for (const a of point.currentDetail?.activities ?? []) add(a.name, 'current', a.deltaPercent)
    for (const a of point.previousDetail?.activities ?? []) add(a.name, 'previous', a.deltaPercent)
  }
  return [...rows.values()].sort((a, b) => (b.current ?? -1) - (a.current ?? -1))
}

function PeriodReportDialog({
  period,
  data,
  loading,
  error,
  onRetry,
  onClose,
  onOpenDetail,
}: {
  period: ManagerPeriod
  data: PeriodComparison | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
  onOpenDetail: (metricKey: ComparisonMetric['key'] | null) => void
}) {
  const words = PERIOD_WORDS[period]
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

  const reported = data?.chart.status === 'ok' ? data.chart.data.currentReported : false
  const rows = data ? activityProgressRows(data) : []
  const causes = data?.causes.status === 'ok' ? data.causes.data.current : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={PERIOD_REPORT_TITLES[period]}
    >
      <button type="button" aria-label="بستن" className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-elevated">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">{PERIOD_REPORT_TITLES[period]}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {data ? `${data.current.label} در برابر ${data.previous.label}` : 'در حال بارگذاری…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && data ? <Spinner className="text-slate-400" /> : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">بستن</span>
            </button>
          </div>
        </header>

        <div className="space-y-5 px-5 py-5">
          {error && !data ? (
            <div className="space-y-3">
              <EmptyNote tone="error" title="بارگذاری گزارش ناموفق بود" description={error} />
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                تلاش دوباره
              </button>
            </div>
          ) : !data ? (
            <LoadingRows rows={6} />
          ) : (
            <>
              {!reported ? (
                <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs leading-6 text-slate-600">
                  <CircleDashed className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                  گزارش پیشرفت {words.current} هنوز ثبت نشده است. همهٔ آیتم‌ها نمایش داده می‌شوند؛ آن‌هایی که داده ندارند
                  خاکستری‌اند و در شمارش بهتر/بدتر حساب نمی‌شوند.
                </p>
              ) : null}
              <SummaryLine data={data} words={words} />
              {data.warnings.length > 0 ? (
                <ul className="space-y-1.5" aria-label="هشدارهای داده">
                  {data.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-6 text-amber-900"
                    >
                      <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                {data.metrics.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} words={words} onOpen={() => onOpenDetail(metric.key)} />
                ))}
              </div>

              <CompareChart data={data} words={words} onOpen={() => onOpenDetail(null)} />
              <section className={cn('rounded-xl border p-3', reported ? 'border-slate-100' : 'border-dashed border-slate-200 bg-slate-50/60')}>
                <h3 className={cn('mb-2 text-[13px] font-semibold', reported ? 'text-slate-700' : 'text-slate-400')}>
                  گزارش پیشرفت فعالیت‌ها
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="py-1.5 text-right font-normal">فعالیت</th>
                      <th className="py-1.5 text-center font-normal">{words.current}</th>
                      <th className="py-1.5 text-center font-normal">{words.previous}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0
                      ? rows.map((row) => (
                          <tr key={row.name} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-700">{row.name}</td>
                            <td
                              className={cn(
                                'py-1.5 text-center tabular-nums',
                                row.current == null ? 'text-slate-300' : 'font-semibold text-emerald-700'
                              )}
                            >
                              {row.current == null ? 'ثبت نشده' : `+${faNumber(row.current, 1)}٪`}
                            </td>
                            <td className={cn('py-1.5 text-center tabular-nums', row.previous == null ? 'text-slate-300' : 'text-slate-600')}>
                              {row.previous == null ? 'ثبت نشده' : `+${faNumber(row.previous, 1)}٪`}
                            </td>
                          </tr>
                        ))
                      : [0, 1, 2].map((i) => (
                          <tr key={i} className="border-t border-slate-100 text-slate-300">
                            <td className="py-1.5">
                              <span className="inline-block h-2.5 w-32 rounded-full bg-slate-200" aria-hidden />
                            </td>
                            <td className="py-1.5 text-center">—</td>
                            <td className="py-1.5 text-center">—</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {rows.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-400">در این بازه پیشرفت ثبت‌شده‌ای برای هیچ فعالیتی وجود ندارد.</p>
                ) : null}
              </section>

              <section className={cn('rounded-xl border p-3', causes.length ? 'border-slate-100' : 'border-dashed border-slate-200 bg-slate-50/60')}>
                <h3 className={cn('mb-2 text-[13px] font-semibold', causes.length ? 'text-slate-700' : 'text-slate-400')}>
                  مسائل و علت‌های ثبت‌شده
                </h3>
                {data.causes.status === 'ok' ? (
                  <CauseList causes={causes} emptyLabel="علت ثبت نشده" />
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    علت ثبت نشده{data.causes.status === 'unavailable' ? ` — ${data.causes.reason}` : ''}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryLine({ data, words }: { data: PeriodComparison; words: { current: string; previous: string } }) {
  const { better, worse, same, neutral } = data.summary
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-slate-800">
        <span className="text-rose-600">{faNumber(worse)} شاخص بدتر</span>
        <span className="mx-1.5 text-slate-300">،</span>
        <span className="text-emerald-600">{faNumber(better)} شاخص بهتر</span>
        {same > 0 ? <span className="font-normal text-slate-500">، {faNumber(same)} بدون تغییر</span> : null}
        {neutral > 0 ? <span className="font-normal text-slate-400">، {faNumber(neutral)} بدون دادهٔ قابل مقایسه</span> : null}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS.current }} aria-hidden />
          {data.current.label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS.previous }} aria-hidden />
          {data.previous.label}
        </span>
        <span className="sr-only">مقایسهٔ {words.current} با {words.previous}</span>
      </p>
    </div>
  )
}

function ChangeBadge({ metric }: { metric: ComparisonMetric }) {
  const { verdict, changePercent, current, previous } = metric
  let text: string
  if (verdict === 'neutral') text = 'غیرقابل مقایسه'
  else if (verdict === 'same') text = 'بدون تغییر'
  else if (changePercent == null) {
    const diff = current.state === 'ok' && previous.state === 'ok' ? current.value - previous.value : 0
    text = `${diff > 0 ? '▲' : '▼'} ${signed(formatValue(metric, Math.abs(diff)), diff)}`
  } else {
    text = `${changePercent > 0 ? '▲' : '▼'} ${faNumber(Math.abs(changePercent), 0)}٪`
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1',
        VERDICT_STYLE[verdict]
      )}
    >
      {text}
    </span>
  )
}

function CompareBar({
  label,
  value,
  max,
  color,
  metric,
}: {
  label: string
  value: ComparisonValue
  max: number
  color: string
  metric: ComparisonMetric
}) {
  const ok = value.state === 'ok'
  const width = ok && max > 0 ? Math.max(3, (Math.abs(value.value) / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{label}</span>
        <span className={cn('tabular-nums', ok ? 'font-semibold text-slate-700' : 'text-slate-400')}>
          {ok
            ? metric.scaleMax
              ? `${formatValue(metric, value.value)} از ${faNumber(metric.scaleMax)}`
              : formatValue(metric, value.value)
            : 'ثبت نشده'}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        {ok ? <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} /> : null}
      </div>
    </div>
  )
}

function MetricCard({
  metric,
  words,
  onOpen,
}: {
  metric: ComparisonMetric
  words: { current: string; previous: string }
  onOpen: () => void
}) {
  const { current, previous } = metric
  const largest = Math.max(
    current.state === 'ok' ? Math.abs(current.value) : 0,
    previous.state === 'ok' ? Math.abs(previous.value) : 0
  )
  const max = Math.max(largest, metric.scaleMax ?? BAR_FULL_SCALE[metric.unit] ?? 0)
  const missing = current.state !== 'ok'
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-xl border p-3 transition-colors',
        missing
          ? 'border-dashed border-slate-200 bg-slate-50/60 grayscale'
          : 'border-slate-100 bg-white hover:border-slate-200'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <h3 className="truncate text-[13px] font-semibold text-slate-700">{metric.label}</h3>
          <InfoHint label={metric.label}>{metric.basis}</InfoHint>
        </div>
        <ChangeBadge metric={metric} />
      </div>

      {current.state === 'ok' ? (
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {metric.unit === 'points'
            ? signed(formatValue(metric, Math.abs(current.value)), current.value)
            : formatValue(metric, current.value)}
        </p>
      ) : (
        <p className="text-sm font-medium leading-6 text-slate-400">
          {current.state === 'not_reported' ? `گزارش ${words.current} هنوز ثبت نشده` : 'داده در دسترس نیست'}
          <span className="block text-[11px] font-normal">{current.reason}</span>
        </p>
      )}

      {metric.levels && metric.levels.current != null ? (
        <p className="text-[11px] leading-5 text-slate-500">
          پیشرفت تجمعی{' '}
          <strong className="font-semibold tabular-nums text-slate-700">{faNumber(metric.levels.current, 1)}٪</strong>
          {metric.levels.planned != null ? (
            <>
              {' '}
              · برنامه <span className="tabular-nums">{faNumber(metric.levels.planned, 1)}٪</span>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-auto space-y-1.5">
        <CompareBar label={words.current} value={current} max={max} color={COLORS.current} metric={metric} />
        <CompareBar label={words.previous} value={previous} max={max} color={COLORS.previous} metric={metric} />
      </div>

      {metric.breakdown && metric.breakdown.some((row) => row.current > 0 || row.previous > 0) ? (
        <ul className="space-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          {metric.breakdown.map((row) => (
            <li key={row.key} className="flex justify-between gap-2">
              <span>{row.label}</span>
              <span className="tabular-nums">
                {faNumber(row.current)} / {faNumber(row.previous)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-0.5 self-start text-[11px] font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        جزئیات و علت‌ها
        <ChevronLeft className="h-3 w-3" aria-hidden />
      </button>
    </div>
  )
}

function Diff({ value, higherIsBetter = true }: { value: number | null; higherIsBetter?: boolean }) {
  if (value == null) return <span className="text-slate-400">—</span>
  const rounded = Math.round(value * 10) / 10
  const good = rounded === 0 ? null : higherIsBetter ? rounded > 0 : rounded < 0
  return (
    <span
      className={cn(
        'font-semibold tabular-nums',
        good == null ? 'text-slate-500' : good ? 'text-emerald-600' : 'text-rose-600'
      )}
    >
      {signed(`${faNumber(Math.abs(rounded), 1)}`, rounded)}
    </span>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { payload?: ComparisonChartPoint }[]
  period: ManagerPeriod
  words: { current: string; previous: string }
}

function pointTitle(period: ManagerPeriod, detail: ComparisonPointDetail | null, label: string): string {
  if (!detail) return label
  if (period === 'today') return `ساعت ${label}`
  return tehranDateTime(detail.at, { weekday: 'long', day: 'numeric', month: 'long' })
}

function ChartTooltip({ active, payload, period, words }: TooltipProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const cur = point.currentDetail
  const prev = point.previousDetail
  const rows: { label: string; current: number | null; previous: number | null; higherIsBetter: boolean }[] = [
    { label: 'نفرات حاضر', current: cur?.headcount ?? null, previous: prev?.headcount ?? null, higherIsBetter: true },
    { label: 'فعالیت تکمیل‌شده', current: cur?.completed ?? null, previous: prev?.completed ?? null, higherIsBetter: true },
    { label: 'مسائل و توقفات', current: cur?.issues ?? null, previous: prev?.issues ?? null, higherIsBetter: false },
  ]
  const activities = cur?.activities.length ? cur.activities : []
  return (
    <div
      dir="rtl"
      className="w-[min(320px,calc(100vw-48px))] rounded-xl border border-slate-200 bg-white p-3 text-right text-xs leading-6 text-slate-700 shadow-elevated"
    >
      <p className="font-bold text-slate-900">{pointTitle(period, cur, point.label)}</p>
      {period !== 'today' && prev ? (
        <p className="text-[11px] text-slate-500">
          {words.previous}: {tehranDateTime(prev.at, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      ) : null}

      <dl className="mt-2 space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.current }} aria-hidden />
            واقعی {words.current}
          </dt>
          <dd className="font-semibold tabular-nums">{point.current == null ? 'ثبت نشده' : `${faNumber(point.current, 1)}٪`}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.previous }} aria-hidden />
            {words.previous}
          </dt>
          <dd className="font-semibold tabular-nums">{point.previous == null ? 'ثبت نشده' : `${faNumber(point.previous, 1)}٪`}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5">
            <span className="h-0 w-3 border-t-2 border-dashed border-slate-900" aria-hidden />
            برنامه
          </dt>
          <dd className="font-semibold tabular-nums">{point.planned == null ? '—' : `${faNumber(point.planned, 1)}٪`}</dd>
        </div>
      </dl>

      {point.current != null ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 border-t border-slate-100 pt-1.5 text-[11px]">
          <span>
            نسبت به {words.previous}:{' '}
            <Diff value={point.previous == null ? null : point.current - point.previous} />
          </span>
          <span>
            نسبت به برنامه: <Diff value={point.planned == null ? null : point.current - point.planned} />
          </span>
        </p>
      ) : null}

      <table className="mt-2 w-full border-t border-slate-100 text-[11px]">
        <thead>
          <tr className="text-slate-400">
            <th className="py-1 text-right font-normal" />
            <th className="py-1 text-center font-normal">{words.current}</th>
            <th className="py-1 text-center font-normal">{words.previous}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-0.5">{row.label}</td>
              <td className="py-0.5 text-center font-semibold tabular-nums text-slate-800">
                {row.current == null ? '—' : faNumber(row.current)}
              </td>
              <td className="py-0.5 text-center tabular-nums">{row.previous == null ? '—' : faNumber(row.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {activities.length > 0 ? (
        <div className="mt-2 border-t border-slate-100 pt-1.5">
          <p className="text-[11px] font-semibold text-slate-500">فعالیت‌های اصلی این نقطه</p>
          <ul className="mt-0.5 space-y-0.5 text-[11px]">
            {activities.map((a) => (
              <li key={a.name} className="flex justify-between gap-2">
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 tabular-nums text-emerald-700">+{faNumber(a.deltaPercent, 1)}٪</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function CompareChart({
  data,
  words,
  onOpen,
}: {
  data: PeriodComparison
  words: { current: string; previous: string }
  onOpen: () => void
}) {
  const chart = data.chart
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <h3 className="text-[13px] font-semibold text-slate-700">پیشرفت تجمعی در بازه</h3>
          <InfoHint label="پیشرفت تجمعی در بازه">
            پیشرفت وزنی تأییدشده که از ابتدای هر بازه افزوده شده (واحد درصد). خط برنامه همان وزن‌ها را روی baseline
            می‌سنجد. خط {words.current} فقط تا همین لحظه رسم می‌شود.
          </InfoHint>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600" aria-label="راهنمای نمودار">
          {(
            [
              ['current', `واقعی ${words.current}`, undefined],
              ['previous', words.previous, undefined],
              ['planned', 'برنامه', '4 3'],
            ] as const
          ).map(([key, label, dash]) => (
            <li key={key} className="inline-flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden>
                <line x1="1" y1="4" x2="17" y2="4" stroke={COLORS[key]} strokeWidth={2.5} strokeDasharray={dash} />
              </svg>
              {label}
            </li>
          ))}
        </ul>
      </div>

      {chart.status === 'error' ? (
        <EmptyNote tone="error" title="بارگذاری نمودار ناموفق بود" description={chart.message} />
      ) : chart.status === 'unavailable' ? (
        <EmptyNote title="نمودار قابل رسم نیست" description={chart.reason} />
      ) : (
        <>
          <figure
            onClick={onOpen}
            aria-label={`نمودار پیشرفت تجمعی ${words.current}، ${words.previous} و برنامه`}
            className="relative h-[240px] w-full cursor-pointer sm:h-[280px]"
          >
            <div className="absolute inset-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart.data.points} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    interval="preserveStartEnd"
                    minTickGap={12}
                  />
                  <YAxis
                    orientation="left"
                    tickFormatter={(v) => `${faNumber(Number(v), 1)}٪`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <ReferenceLine
                    x={chart.data.points[chart.data.cutoffIndex]?.label}
                    stroke="#cbd5e1"
                    strokeDasharray="4 4"
                    label={{ value: 'اکنون', position: 'top', fill: '#334155', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    content={<ChartTooltip period={data.period} words={words} />}
                    wrapperStyle={{ zIndex: 30, outline: 'none' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    stroke={COLORS.planned}
                    strokeWidth={1.75}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: COLORS.planned }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke={COLORS.previous}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: COLORS.previous }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke={COLORS.current}
                    strokeWidth={2.75}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: COLORS.current }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <div className="mt-2 space-y-0.5 text-[11px] leading-5 text-slate-500">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-0.5 font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              جزئیات و علت‌ها
              <ChevronLeft className="h-3 w-3" aria-hidden />
            </button>
            {!chart.data.currentReported ? <p>برای {words.current} هنوز گزارش پیشرفتی ثبت نشده؛ خط واقعی رسم نمی‌شود.</p> : null}
            {!chart.data.previousDrawn ? (
              <p>برای {words.previous} هنوز تاریخچهٔ پیشرفتی ثبت نشده بود؛ خط آن رسم نمی‌شود.</p>
            ) : !chart.data.previousReported ? (
              <p>در {words.previous} گزارش پیشرفتی ثبت نشده؛ خط آن صاف (بدون افزایش) است.</p>
            ) : chart.data.historyStart && Date.parse(chart.data.historyStart) > Date.parse(data.previous.start) ? (
              <p>
                ثبت پیشرفت از {tehranDateTime(chart.data.historyStart, { day: 'numeric', month: 'long' })} شروع شده؛ خط{' '}
                {words.previous} پیش از آن صاف است و فقط تغییرات ثبت‌شده را نشان می‌دهد.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function CauseList({ causes, emptyLabel }: { causes: ComparisonCause[]; emptyLabel: string }) {
  if (causes.length === 0) {
    return <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-2">
      {causes.map((cause) => (
        <li key={cause.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs leading-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{cause.category}</span>
            <span>
              {CAUSE_SOURCE_LABELS[cause.source]} ·{' '}
              {tehranDateTime(cause.at, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-slate-700">{cause.text}</p>
          {cause.activity ? <p className="text-[11px] text-slate-500">فعالیت: {cause.activity}</p> : null}
        </li>
      ))}
    </ul>
  )
}

function DetailsPanel({
  data,
  words,
  metricKey,
  onClose,
}: {
  data: PeriodComparison
  words: { current: string; previous: string }
  metricKey: ComparisonMetric['key'] | null
  onClose: () => void
}) {
  const metric = metricKey ? data.metrics.find((m) => m.key === metricKey) ?? null : null
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const causes = data.causes
  const noCauseText = 'علت ثبت نشده'

  return (
    <div className="fixed inset-0 z-50 flex justify-start" role="dialog" aria-modal="true" aria-label="جزئیات مقایسه">
      <button type="button" aria-label="بستن" className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-elevated">
        <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-5 py-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800">{metric ? metric.label : 'پیشرفت تجمعی در بازه'}</h2>
            <p className="text-[11px] text-slate-500">
              {data.current.label} در برابر {data.previous.label}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">بستن</span>
          </button>
        </header>

        <div className="space-y-5 px-5 py-4">
          {metric ? (
            <section className="space-y-2 text-xs leading-6">
              <p className="text-slate-500">{metric.basis}</p>
              <DetailValue label={words.current} value={metric.current} metric={metric} />
              <DetailValue label={words.previous} value={metric.previous} metric={metric} />
              {metric.breakdown ? (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="py-1 text-right font-normal">نوع</th>
                      <th className="py-1 text-center font-normal">{words.current}</th>
                      <th className="py-1 text-center font-normal">{words.previous}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metric.breakdown.map((row) => (
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="py-1">{row.label}</td>
                        <td className="py-1 text-center tabular-nums">{faNumber(row.current)}</td>
                        <td className="py-1 text-center tabular-nums">{faNumber(row.previous)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-slate-700">علت‌های ثبت‌شده</h3>
            {causes.status === 'error' ? (
              <EmptyNote tone="error" title="بارگذاری علت‌ها ناموفق بود" description={causes.message} />
            ) : causes.status === 'unavailable' ? (
              <EmptyNote title={noCauseText} description={causes.reason} />
            ) : (
              <>
                <DetailGroup title={words.current}>
                  <CauseList causes={causes.data.current} emptyLabel={noCauseText} />
                </DetailGroup>
                <DetailGroup title={words.previous}>
                  <CauseList causes={causes.data.previous} emptyLabel={noCauseText} />
                </DetailGroup>
              </>
            )}
            <p className="text-[11px] leading-5 text-slate-400">
              علت‌ها فقط از مسائل ثبت‌شده در گزارش روزانه، ثبت‌های «مسدود/ناقص» کارگاه و محدودیت‌های برنامهٔ روزانه خوانده
              می‌شوند. برای فعالیت‌های زمان‌بندی هنوز فیلد «علت تأخیر» وجود ندارد.
            </p>
          </section>
        </div>
      </aside>
    </div>
  )
}

function DetailValue({ label, value, metric }: { label: string; value: ComparisonValue; metric: ComparisonMetric }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5">
      <span>{label}</span>
      {value.state === 'ok' ? (
        <strong className="tabular-nums text-slate-900">{formatValue(metric, value.value)}</strong>
      ) : (
        <span className="text-slate-400">{value.reason}</span>
      )}
    </div>
  )
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-500">{title}</p>
      {children}
    </div>
  )
}
