'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CalendarRange,
  Gauge,
  Minus,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildPmAnalytics,
  KPI_STATE_COLORS,
  type AnalyticsKpi,
  type PmAnalyticsData,
} from '@/lib/project-manager/analytics'
import { buildExecutiveSummary, phaseLabelFa } from '@/lib/managerial/build-executive'
import { ExecutiveLayer } from '@/components/managerial/executive-layer'
import { ActionNowBox } from '@/components/managerial/action-now-box'
import { RecentReportsPanel } from '@/components/managerial/recent-reports-panel'
import { PmControlKpis } from '@/components/project-manager/pm-control-kpis'
import { PmDataGapsPanel } from '@/components/project-manager/pm-data-gaps-panel'
import { PmMetricHelpButton } from '@/components/project-manager/pm-metric-help-button'
import { PmPlanComplianceTable } from '@/components/project-manager/pm-plan-compliance-table'
import { UiBlockGuard } from '@/components/dashboard/ui-block-visibility'
import type { PmMetricGuideId } from '@/lib/project-manager/pm-metric-guides'
import { PM_KPI_BLOCK_CODE } from '@/lib/dashboard/ui-block-catalog'
import type { PmDataGap } from '@/lib/project-manager/data-gaps'
import type { PlanComplianceSummary } from '@/lib/project-manager/plan-compliance'
import type { ProjectHealthStatus } from '@/lib/project-manager/types'
import type { ProjectAlert, ProjectScheduleSummary, SiteDailyReport } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface PmAnalyticsControlRoomProps {
  projectName: string
  summary: ProjectScheduleSummary
  health: ProjectHealthStatus
  alerts: ProjectAlert[]
  reports?: SiteDailyReport[]
  compliance?: PlanComplianceSummary | null
  dataGaps?: PmDataGap[]
  projectOptions: { id: string; name: string }[]
  projectId: string | null
  isRtl?: boolean
  isFa?: boolean
}

function TrendIcon({ value }: { value: number }) {
  if (value > 1) return <ArrowUpRight className="h-4 w-4 text-emerald-600" />
  if (value < -1) return <ArrowDownRight className="h-4 w-4 text-red-600" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="h-10 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const KPI_HELP_ID: Record<AnalyticsKpi['key'], PmMetricGuideId> = {
  wsi: 'wsi',
  mrs: 'mrs',
  csi: 'csi',
}

function KpiAnalyticsCard({ kpi, isFa = true }: { kpi: AnalyticsKpi; isFa?: boolean }) {
  const color = KPI_STATE_COLORS[kpi.state]
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md',
        kpi.state === 'critical' && 'border-red-200/80',
        kpi.state === 'warning' && 'border-amber-200/80',
        kpi.state === 'healthy' && 'border-emerald-200/60'
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
            <PmMetricHelpButton metricId={KPI_HELP_ID[kpi.key]} isFa={isFa} className="h-6 px-1.5" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-bold tracking-tight" style={{ color }}>
              {kpi.value}
            </span>
            <span className="text-sm text-muted-foreground">{kpi.unit}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TrendIcon value={kpi.trend} />
          <span
            className={cn(
              'text-xs font-medium',
              kpi.trend > 0 ? 'text-emerald-600' : kpi.trend < 0 ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {kpi.trend > 0 ? '+' : ''}
            {kpi.trend}%
          </span>
        </div>
      </div>
      <MiniSparkline data={kpi.sparkline} color={color} />
      <p className="text-[10px] text-muted-foreground mt-2">Threshold: {kpi.threshold}</p>
    </div>
  )
}

function RiskAlertsPanel({ data, isFa = true }: { data: PmAnalyticsData; isFa?: boolean }) {
  const severityStyle = {
    critical: 'border-red-200 bg-red-50/80 dark:bg-red-950/30',
    warning: 'border-amber-200 bg-amber-50/80 dark:bg-amber-950/30',
    info: 'border-slate-200 bg-slate-50/80 dark:bg-slate-900/40',
  }
  const dot = { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-slate-400' }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <h3 className="font-semibold">هشدارهای ریسک</h3>
        </div>
        <PmMetricHelpButton metricId="risk-alerts" isFa={isFa} />
      </div>
      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {data.riskAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn('rounded-xl border p-4 space-y-1.5', severityStyle[alert.severity])}
          >
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full shrink-0', dot[alert.severity])} />
              <p className="text-sm font-semibold">{alert.title}</p>
              <Badge variant="outline" className="ms-auto text-[10px]">
                {alert.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed ps-4">{alert.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightsPanel({ data, isFa = true }: { data: PmAnalyticsData; isFa?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">بینش‌های عملیاتی</h3>
        </div>
        <PmMetricHelpButton metricId="insights" isFa={isFa} />
      </div>
      <div className="p-4 space-y-3">
        {data.insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed flex gap-3"
          >
            <TrendingUp
              className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                insight.severity === 'critical'
                  ? 'text-red-600'
                  : insight.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-blue-600'
              )}
            />
            <p>{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PmAnalyticsControlRoom({
  projectName,
  summary,
  health,
  alerts,
  reports = [],
  compliance = null,
  dataGaps = [],
  projectOptions,
  projectId,
  isRtl,
  isFa = true,
}: PmAnalyticsControlRoomProps) {
  const [range, setRange] = useState('14')

  const executive = useMemo(
    () => buildExecutiveSummary(summary, health, alerts),
    [summary, health, alerts]
  )

  const analytics = useMemo(
    () => buildPmAnalytics(projectName, summary, health, alerts, compliance),
    [projectName, summary, health, alerts, compliance]
  )

  const trendData = useMemo(() => {
    const days = Number(range) || 14
    return analytics.trends.slice(-days)
  }, [analytics.trends, range])

  const chartTick = (v: string) => v.slice(5)
  const phaseFa = phaseLabelFa(summary.overallPercentComplete)

  return (
    <div className={cn('space-y-8', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
      <ExecutiveLayer summary={executive} projectName={projectName} phaseFa={phaseFa} />

      <UiBlockGuard code="PM-KPI-01">
        <PmControlKpis
          summary={summary}
          health={health}
          compliance={compliance}
          isFa={isFa}
        />
      </UiBlockGuard>

      {compliance ? (
        <PmPlanComplianceTable compliance={compliance} isFa={isFa} isRtl={isRtl} />
      ) : null}

      {dataGaps.length > 0 ? <PmDataGapsPanel gaps={dataGaps} isFa={isFa} /> : null}

      <UiBlockGuard code="PM-ACT-01">
        <ActionNowBox actions={executive.prioritizedActions} />
      </UiBlockGuard>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">لایه ۲ — جزئیات تحلیلی</p>
        <div className="flex flex-wrap gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]">
              <CalendarRange className="h-4 w-4 me-2 opacity-70" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">۷ روز اخیر</SelectItem>
              <SelectItem value="14">۱۴ روز اخیر</SelectItem>
              <SelectItem value="30">۳۰ روز اخیر</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {analytics.kpis.map((kpi) => (
          <UiBlockGuard key={kpi.key} code={PM_KPI_BLOCK_CODE[kpi.key] ?? 'PM-KPI-01'}>
            <KpiAnalyticsCard kpi={kpi} isFa={isFa} />
          </UiBlockGuard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <UiBlockGuard code="PM-CHT-01">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  روند WSI و MRS
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  خطوط نقطه‌چین: حداقل WSI (۷۰) و MRS (۷۵) — زیر این خط = هشدار
                </p>
              </div>
              <PmMetricHelpButton metricId="wsi-mrs-trend" isFa={isFa} />
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={chartTick} tick={{ fontSize: 11 }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(l) => `تاریخ: ${l}`}
                  />
                  <Legend />
                  <ReferenceLine y={70} stroke="#d97706" strokeDasharray="4 4" label="حد WSI" />
                  <ReferenceLine y={75} stroke="#2563eb" strokeDasharray="4 4" label="حد MRS" />
                  <Line type="monotone" dataKey="wsi" name="WSI" stroke="#059669" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="mrs" name="MRS" stroke="#d97706" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="csi" name="CSI" stroke="#2563eb" strokeWidth={2} dot={false} strokeDasharray="6 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
              اگر WSI و MRS همزمان نزولی باشند، احتمال تأخیر زنجیره‌ای در اجرا بالاست — با سرپرست کارگاه هماهنگ کنید.
            </p>
          </div>
          </UiBlockGuard>

          <UiBlockGuard code="PM-CHT-02">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  وضعیت فعالیت‌های موعد تا امروز
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  سهم انجام‌شده / مطابق / عقب / شروع‌نشده از فعالیت‌هایی که باید تا امروز شروع شده باشند
                </p>
              </div>
              <PmMetricHelpButton metricId="due-activities" isFa={isFa} />
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.zoneProgress} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="zone" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={56} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="actual" name="سهم از فعالیت‌های موعد %" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
              ستون «عقب از برنامه» و «شروع‌نشده» اولویت پیگیری مدیر پروژه هستند.
            </p>
          </div>
          </UiBlockGuard>

          <UiBlockGuard code="PM-TBL-02">
            <RecentReportsPanel reports={reports} />
          </UiBlockGuard>
        </div>

        <div className="space-y-6">
          <UiBlockGuard code="PM-CHT-03">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold">آمادگی کلی پروژه</h3>
              <PmMetricHelpButton metricId="readiness-donut" isFa={isFa} />
            </div>
            <p className="text-xs text-muted-foreground mb-4">ترکیب نیرو، مصالح و زمان‌بندی</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.readinessBreakdown.map((e) => ({
                      ...e,
                      name:
                        e.name === 'Workforce'
                          ? 'نیرو'
                          : e.name === 'Materials'
                            ? 'مصالح'
                            : e.name === 'Schedule'
                              ? 'زمان‌بندی'
                              : 'حاشیه ریسک',
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {analytics.readinessBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              بخش «حاشیه ریسک» هرچه بزرگ‌تر = فاصله بیشتر از وضعیت پایدار.
            </p>
          </div>
          </UiBlockGuard>

          <UiBlockGuard code="PM-PNL-04">
            <RiskAlertsPanel data={analytics} isFa={isFa} />
          </UiBlockGuard>
          <UiBlockGuard code="PM-PNL-05">
            <InsightsPanel data={analytics} isFa={isFa} />
          </UiBlockGuard>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 flex items-start gap-3 text-xs text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          شاخص‌های کنترل از برنامه جاری، پیشرفت واقعی فعالیت‌ها، انبار و هشدارها محاسبه می‌شوند. روند
          ۱۴روزه تقریبی است تا تاریخچه روزانه ذخیره شود. کمبود داده در پنل بالا با مسیر تکمیل مشخص شده است.
        </p>
      </div>
    </div>
  )
}
