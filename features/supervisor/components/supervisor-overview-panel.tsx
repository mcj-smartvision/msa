/**
 * @file features/supervisor/components/supervisor-overview-panel.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (supervisor-overview-panel)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on app/app-font, shared/lib/utils, features/supervisor/lib/daily-progress-storage, features/project-store/use-store-progress, features/supervisor/lib/daily-report-activities, features/workshop/lib/types
 */

'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
Chart as ChartJS,
ArcElement,
CategoryScale,
LinearScale,
PointElement,
LineElement,
Tooltip,
Legend,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import {
AlertTriangle,
ArrowDown,
ArrowUp,
CalendarClock,
CheckCircle2,
ShieldAlert,
TrendingUp,
} from 'lucide-react'
import { appFontFamily } from '@/app/app-font'
import { cn } from '@/shared/lib/utils'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { useStoreProgress } from '@/features/project-store/use-store-progress'
import {
buildDailyReportActivitiesFromTree,
buildProjectProgressSeries,
buildSCurveActivitiesFromTree,
calculateSCurveActualProgress,
earliestScheduleStartFromTree,
type DailyReportActivity,
type ProjectProgressSeriesPoint,
} from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import { SUPERVISOR_COPY } from '@/features/supervisor/config'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'

const t = siteSupervisorT

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)
ChartJS.defaults.font.family = appFontFamily

const SITE_NAVY = 'text-[#1e3a5f]'

/** اعداد فارسی برای UI mock */
function faNum(value: number): string {
  return value.toLocaleString('fa-IR-u-nu-latn')
}

type RiskLevel = 'low' | 'medium' | 'high'

const RISK_LABEL: Record<RiskLevel, string> = {
  low: t.riskLow,
  medium: t.riskMedium,
  high: t.riskHigh,
}

const RISK_CLASS: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-900 border-amber-200',
  high: 'bg-rose-100 text-rose-800 border-rose-200',
}

type ProjectHealth = 'normal' | 'at_risk'

const HEALTH_BANNER: Record<
  ProjectHealth,
  { message: string; bar: string; icon: string }
> = {
  normal: {
    message: t.healthNormal,
    bar: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
    icon: 'text-emerald-600',
  },
  at_risk: {
    message: t.healthAtRisk,
    bar: 'border-rose-200 bg-rose-50/90 text-rose-950',
    icon: 'text-rose-600',
  },
}

/** داده نمایشی — بدون منطق واقعی */
const MOCK = {
  progressActual: 66,
  progressDeltaYesterday: 0.4,
  criticalToday: 1,
  activitiesTotal: 28,
  delayDays: 0,
  readinessPercent: 89,
  readinessRisk: 'low' as RiskLevel,
  safety: {
    critical: 2,
    needsReview: 3,
    solved: 4,
  },
  chartDays: [t.weekdaySat, t.weekdaySun, t.weekdayMon, t.weekdayTue, t.weekdayWed, t.weekdayThu, t.weekdayFri],
  chartPlanned: [61, 62, 63, 64, 65, 66, 67],
}

/** وضعیت کلی پروژه از شاخص‌های mock (بعداً از API واقعی) */
function deriveProjectHealth(data: typeof MOCK): ProjectHealth {
  const plannedEnd = data.chartPlanned[data.chartPlanned.length - 1] ?? 0
  const progressGap = plannedEnd - data.progressActual

  if (
    data.delayDays <= 1 &&
    data.criticalToday <= 2 &&
    data.readinessRisk !== 'high' &&
    progressGap <= 3
  ) {
    return 'normal'
  }

  return 'at_risk'
}

function OverviewKpiCard({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function progressTone(percent: number): { fill: string; track: string; label: string } {
  if (percent >= 75) {
    return { fill: '#059669', track: '#d1fae5', label: t.progressGood }
  }
  if (percent >= 40) {
    return { fill: '#1e3a5f', track: '#e2e8f0', label: t.onTrackExec }
  }
  if (percent >= 15) {
    return { fill: '#d97706', track: '#fef3c7', label: t.needsSpeed }
  }
  return { fill: '#e11d48', track: '#ffe4e6', label: t.progressLow }
}

function ProgressDonut({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)))
  const remaining = Math.max(0, 100 - clamped)
  const tone = progressTone(clamped)

  const data = {
    labels: [t.progressed, t.remaining],
    datasets: [
      {
        data: [clamped, remaining],
        backgroundColor: [tone.fill, tone.track],
        borderWidth: 0,
        hoverOffset: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        rtl: true,
        titleFont: { family: appFontFamily },
        bodyFont: { family: appFontFamily },
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) =>
            SUPERVISOR_COPY.labeledPct(ctx.label ?? '', faNum(ctx.parsed)),
        },
      },
    },
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-10">
      <div className="relative h-44 w-44 sm:h-52 sm:w-52">
        <Doughnut data={data} options={options} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: tone.fill }}>
            {SUPERVISOR_COPY.pct(faNum(clamped))}
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-slate-500">{t.totalProgress}</span>
        </div>
      </div>
      <div className="space-y-2 text-center sm:text-right">
        <p className="text-sm font-bold text-slate-900">{t.quickProgressTitle}</p>
        <p className="text-xs text-slate-500">{t.sameWeightedHint}</p>
        <span
          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: tone.fill }}
        >
          {tone.label}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] text-slate-600 sm:justify-start">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone.fill }} />
            {t.doneLabel} {SUPERVISOR_COPY.pct(faNum(clamped))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone.track }} />
            {t.remaining} {SUPERVISOR_COPY.pct(faNum(remaining))}
          </span>
        </div>
      </div>
    </div>
  )
}

function ProgressSparkline({ series }: { series: ProjectProgressSeriesPoint[] }) {
  const labels = series.map((p) => p.label)
  const actualData = series.map((p) => p.actual)
  const plannedData = series.map((p) => p.planned)
  const numericValues = [...actualData, ...plannedData].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  const maxVal = numericValues.length ? Math.max(...numericValues, 0) : 0
  const yMax = Math.min(100, Math.max(25, Math.ceil(maxVal / 5) * 5 + 5))
  const dense = series.length > 40
  const dates = series.map((p) => p.date)

  const data = {
    labels,
    datasets: [
      {
        label: t.actualProgressShort,
        data: actualData,
        borderColor: '#1e3a5f',
        backgroundColor: 'rgba(30, 58, 95, 0.08)',
        borderWidth: 2,
        pointRadius: dense ? 0 : 2,
        pointHoverRadius: 4,
        pointBackgroundColor: '#1e3a5f',
        tension: 0.2,
        fill: false,
        spanGaps: false,
      },
      {
        label: t.planned,
        data: plannedData,
        borderColor: '#94a3b8',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        align: 'start' as const,
        labels: {
          boxWidth: 12,
          boxHeight: 8,
          font: { family: appFontFamily, size: 12, weight: 'bold' as const },
          color: '#334155',
        },
      },
      tooltip: {
        rtl: true,
        titleFont: { family: appFontFamily },
        bodyFont: { family: appFontFamily },
        callbacks: {
          title: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex ?? 0
            const iso = dates[idx]
            if (!iso) return ''
            return new Date(`${iso}T12:00:00`).toLocaleDateString('fa-IR-u-nu-latn', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          },
          label: (ctx: {
            dataset: { label?: string }
            parsed: { y: number | null }
          }) => {
            if (ctx.parsed.y == null || !Number.isFinite(ctx.parsed.y)) return undefined
            return SUPERVISOR_COPY.labeledPct(ctx.dataset.label ?? '', faNum(ctx.parsed.y))
          },
        },
      },
    },
    scales: {
      x: {
        border: { display: true, color: '#64748b', width: 1.5 },
        grid: {
          display: true,
          color: '#94a3b8',
          lineWidth: 1,
          drawTicks: true,
        },
        ticks: {
          maxTicksLimit: 10,
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          autoSkipPadding: 8,
          font: {
            family: appFontFamily,
            size: 12,
            weight: 'bold' as const,
          },
          color: '#0f172a',
          padding: 8,
        },
      },
      y: {
        min: 0,
        max: yMax,
        border: { display: true, color: '#64748b', width: 1.5 },
        grid: {
          display: true,
          color: '#94a3b8',
          lineWidth: 1,
          drawTicks: true,
        },
        ticks: {
          stepSize: 5,
          callback: (v: string | number) => SUPERVISOR_COPY.pct(faNum(Number(v))),
          font: {
            family: appFontFamily,
            size: 12,
            weight: 'bold' as const,
          },
          color: '#0f172a',
          padding: 8,
        },
      },
    },
  }

  return (
    <div className="h-[280px] w-full sm:h-[320px]">
      <Line data={data} options={options} />
    </div>
  )
}

export type SupervisorOverviewPanelProps = {
  projectId?: string | null
  onViewSafety?: () => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

const EMPTY_PROGRESS_SERIES: ProjectProgressSeriesPoint[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  const iso = d.toISOString().slice(0, 10)
  return { date: iso, label: weekdayLabelFromIso(iso), actual: 0, planned: 0 }
})

function weekdayLabelFromIso(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fa-IR-u-nu-latn', { weekday: 'short' })
}

export function SupervisorOverviewPanel({
  projectId,
  onViewSafety,
}: SupervisorOverviewPanelProps) {
  const storeProgress = useStoreProgress(projectId)
  const [curveActivities, setCurveActivities] = useState<DailyReportActivity[]>([])
  const [packageActivities, setPackageActivities] = useState<DailyReportActivity[]>([])
  const [scheduleStartDate, setScheduleStartDate] = useState<string | null>(null)
  const [progressActual, setProgressActual] = useState(0)
  const [progressDelta, setProgressDelta] = useState(0)
  const [progressSeries, setProgressSeries] = useState<ProjectProgressSeriesPoint[]>(
    EMPTY_PROGRESS_SERIES
  )

  useEffect(() => {
    if (!projectId) {
      setCurveActivities([])
      setPackageActivities([])
      setScheduleStartDate(null)
      return
    }
    fetch(`/api/workshop/schedule-tree?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) {
          setCurveActivities([])
          setPackageActivities([])
          setScheduleStartDate(null)
          return
        }
        const nodes = (data.nodes ?? []) as ScheduleTreeNode[]
        const orphanPackages = (data.orphanPackages ?? []) as WorkshopPackageNode[]
        try {
          const packages = buildDailyReportActivitiesFromTree(nodes, orphanPackages).filter(
            (a) => a.kind === 'package'
          )
          setPackageActivities(packages)
          setCurveActivities(buildSCurveActivitiesFromTree(nodes))
          setScheduleStartDate(earliestScheduleStartFromTree(nodes))
        } catch {
          setCurveActivities([])
          setPackageActivities([])
          setScheduleStartDate(null)
        }
      })
      .catch(() => {
        setCurveActivities([])
        setPackageActivities([])
        setScheduleStartDate(null)
      })
  }, [projectId])

  useEffect(() => {
    if (!projectId) return

    function refresh() {
      const entries = storeProgress.entries ?? readProjectDailyProgress(projectId!).entries
      const today = todayIso()
      const yesterday = yesterdayIso()

      const todayOverall = calculateSCurveActualProgress(
        curveActivities,
        entries,
        today,
        today,
        packageActivities
      )
      const yesterdayOverall = calculateSCurveActualProgress(
        curveActivities,
        entries,
        yesterday,
        today,
        packageActivities
      )

      setProgressActual(todayOverall)
      setProgressDelta(todayOverall - yesterdayOverall)
      setProgressSeries(
        buildProjectProgressSeries(
          curveActivities,
          entries,
          today,
          scheduleStartDate,
          packageActivities
        )
      )
    }

    refresh()

    function onUpdated(event: Event) {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (detail?.projectId === projectId) refresh()
    }

    window.addEventListener('sitepilot-daily-progress-updated', onUpdated)
    return () => window.removeEventListener('sitepilot-daily-progress-updated', onUpdated)
  }, [projectId, curveActivities, packageActivities, scheduleStartDate, storeProgress.entries])

  const overviewKpis = {
    ...MOCK,
    progressActual,
    progressDeltaYesterday: progressDelta,
    activitiesTotal: curveActivities.length,
    chartPlanned: progressSeries.map((p) => p.planned),
  }

  const delta = progressDelta
  const deltaUp = delta >= 0
  const projectHealth = deriveProjectHealth(overviewKpis)
  const healthBanner = HEALTH_BANNER[projectHealth]

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm',
          healthBanner.bar
        )}
        role="status"
      >
        {projectHealth === 'normal' ? (
          <CheckCircle2
            className={cn('mt-0.5 h-5 w-5 shrink-0', healthBanner.icon)}
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className={cn('mt-0.5 h-5 w-5 shrink-0', healthBanner.icon)}
            aria-hidden="true"
          />
        )}
        <p className="leading-relaxed font-medium">{healthBanner.message}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewKpiCard label={t.kpiProgressVsPlan}>
          <div className="flex items-end gap-2">
            <span className={cn('text-3xl font-bold tabular-nums', SITE_NAVY)}>
              {SUPERVISOR_COPY.pct(faNum(progressActual))}
            </span>
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-semibold',
                deltaUp ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {deltaUp ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {SUPERVISOR_COPY.pct(faNum(Math.abs(delta)))}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t.weightedAvgHint}
          </p>
        </OverviewKpiCard>

        <OverviewKpiCard label={t.kpiCriticalToday}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-rose-700">
              {faNum(MOCK.criticalToday)}
            </span>
            <span className="text-sm text-slate-500">
              {t.ofActivities(faNum(overviewKpis.activitiesTotal))}
            </span>
          </div>
        </OverviewKpiCard>

        <OverviewKpiCard label={t.kpiDelay}>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <span className="text-3xl font-bold tabular-nums text-slate-900">
              {faNum(MOCK.delayDays)} {t.daysUnit}
            </span>
          </div>
        </OverviewKpiCard>

        <OverviewKpiCard label={t.kpiReadinessToday}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">
              {SUPERVISOR_COPY.pct(faNum(MOCK.readinessPercent))}
            </span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-semibold',
                RISK_CLASS[MOCK.readinessRisk]
              )}
            >
              {t.riskPrefix} {RISK_LABEL[MOCK.readinessRisk]}
            </span>
          </div>
        </OverviewKpiCard>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#1e3a5f]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">{t.safetyToday}</h2>
          </div>
          {onViewSafety ? (
            <button
              type="button"
              onClick={onViewSafety}
              className="text-sm font-medium text-[#1e3a5f] underline-offset-2 hover:underline"
            >
              {t.viewAll}
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <SafetyDot
            color="bg-rose-500"
            label={t.critical}
            value={MOCK.safety.critical}
          />
          <SafetyDot
            color="bg-amber-400"
            label={t.needsReview}
            value={MOCK.safety.needsReview}
          />
          <SafetyDot
            color="bg-emerald-500"
            label={t.solved}
            value={MOCK.safety.solved}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t.sCurveTitle}</h2>
              <p className="text-[11px] text-slate-500">
                {t.sCurveHint}
              </p>
            </div>
          </div>
          <ProgressSparkline series={progressSeries} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ProgressDonut percent={progressActual} />
        </div>
      </div>
    </div>
  )
}

function SafetyDot({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} aria-hidden="true" />
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-lg font-bold tabular-nums text-slate-900">{faNum(value)}</span>
    </div>
  )
}
