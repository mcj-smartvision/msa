'use client'

import { useMemo, useState, useEffect } from 'react'
import { readProjectCookie } from '@/shared/lib/project/project-cookie'
import {
Bar,
BarChart,
Cell,
Legend,
Pie,
PieChart,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from 'recharts'
import { AlertTriangle, Calendar, Gauge, Network, ShieldAlert } from 'lucide-react'
import { PageHeader, SectionCard } from '@/features/admin/components/shared'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { analyzeScheduleFromXml } from '@/features/schedule-intelligence/lib'
import { exportAnalysisJson, exportTasksToCsv } from '@/features/schedule-intelligence/lib/export-utils'
import { topActivitiesBy, effectiveTaskDurationDays, taskDurationSharePercent } from '@/features/schedule-intelligence/lib/schedule-metrics'
import type { ScheduleDashboardResult, ScheduleTask } from '@/shared/types/schedule-intelligence'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import { ScheduleUpload, ExportButtons } from '@/features/schedule-intelligence/components/schedule-upload'
import { ScheduleDownloadButton } from '@/features/schedule/components/schedule-download-button'
import { cn } from '@/shared/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  'not-started': 'شروع‌نشده',
  'in-progress': 'در حال انجام',
  completed: 'تکمیل',
  unknown: 'نامشخص',
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function ActivitiesTable({
  tasks,
  onSelect,
  filter,
  projectDurationDays,
  minutesPerDay = 480,
}: {
  tasks: ScheduleTask[]
  onSelect: (t: ScheduleTask) => void
  filter?: string
  projectDurationDays?: number
  minutesPerDay?: number
}) {
  const [search, setSearch] = useState('')
  const q = filter ?? search
  const rows = tasks
    .filter(
      (t) =>
        !t.isSummary &&
        (q === '' ||
          t.name.includes(q) ||
          (t.wbs?.includes(q) ?? false) ||
          t.uid.includes(q))
    )
    .sort((a, b) => compareWbs(a.wbs, b.wbs))

  return (
    <div className="space-y-3">
      {projectDurationDays != null && projectDurationDays > 0 ? (
        <p className="text-xs text-muted-foreground">
          مدت کل پروژه (CPM):{' '}
          <span className="font-semibold tabular-nums">
            {projectDurationDays.toLocaleString('fa-IR')} روز
          </span>
          — ستون «سهم از کل» = مدت هر فعالیت ÷ مدت کل پروژه
        </p>
      ) : null}
      <Input
        placeholder="جستجو نام، WBS، UID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      <div className="overflow-x-auto rounded-lg border max-h-[480px]">
        <table className="w-full text-sm text-right">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="p-2">نام</th>
              <th className="p-2">WBS</th>
              <th className="p-2">مدت (روز)</th>
              {projectDurationDays != null ? (
                <th className="p-2">سهم از کل</th>
              ) : null}
              <th className="p-2">پیشرفت</th>
              <th className="p-2">شناوری</th>
              <th className="p-2">ریسک</th>
              <th className="p-2">بحرانی</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((t) => {
              const durationDays = effectiveTaskDurationDays(t, minutesPerDay)
              const share =
                projectDurationDays != null
                  ? taskDurationSharePercent(t, projectDurationDays, minutesPerDay)
                  : null
              return (
              <tr
                key={t.uid}
                className="border-t hover:bg-muted/30 cursor-pointer"
                onClick={() => onSelect(t)}
              >
                <td className="p-2 max-w-[200px] truncate">{t.name}</td>
                <td className="p-2">{t.wbs ?? '—'}</td>
                <td className="p-2 tabular-nums">{durationDays.toLocaleString('fa-IR')}</td>
                {share != null ? (
                  <td className="p-2 tabular-nums font-medium text-primary">
                    {share.toLocaleString('fa-IR')}٪
                  </td>
                ) : null}
                <td className="p-2 tabular-nums">{t.percentComplete.toLocaleString('fa-IR')}٪</td>
                <td className="p-2">
                  {t.totalFloatMinutes != null
                    ? (t.totalFloatMinutes / minutesPerDay).toLocaleString('fa-IR')
                    : '—'}
                </td>
                <td className="p-2">
                  {t.riskLevel ? (
                    <Badge variant="outline">{t.riskLevel}</Badge>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-2">{t.calculatedCritical ? '✓' : ''}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 200 ? (
        <p className="text-xs text-muted-foreground">نمایش ۲۰۰ از {rows.length.toLocaleString('fa-IR')} فعالیت</p>
      ) : null}
    </div>
  )
}

function ActivityDrawer({
  task,
  onClose,
}: {
  task: ScheduleTask | null
  onClose: () => void
}) {
  if (!task) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card h-full shadow-xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="font-bold text-lg">{task.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>بستن</Button>
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-muted-foreground">UID</dt><dd>{task.uid}</dd></div>
          <div><dt className="text-muted-foreground">WBS</dt><dd>{task.wbs ?? '—'}</dd></div>
          <div><dt className="text-muted-foreground">مدت (روز)</dt>
            <dd>{effectiveTaskDurationDays(task, 480).toLocaleString('fa-IR')}</dd>
          </div>
          <div><dt className="text-muted-foreground">وضعیت</dt><dd>{STATUS_LABELS[task.status]}</dd></div>
          <div><dt className="text-muted-foreground">شناوری کل (روز)</dt>
            <dd>{task.totalFloatMinutes != null ? (task.totalFloatMinutes / 480).toLocaleString('fa-IR') : '—'}</dd>
          </div>
          <div><dt className="text-muted-foreground">امتیاز ریسک</dt><dd>{task.riskScore ?? '—'}</dd></div>
          {task.riskReasons.length > 0 ? (
            <div>
              <dt className="text-muted-foreground mb-1">دلایل ریسک</dt>
              <ul className="list-disc pr-4 space-y-1">
                {task.riskReasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground mb-1">پیش‌نیازها</dt>
            <dd>{task.predecessors.map((p) => `${p.predecessorUid} (${p.type})`).join('، ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground mb-1">پس‌نیازها</dt>
            <dd>{task.successors.map((s) => `${s.successorUid} (${s.type})`).join('، ') || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export function ScheduleIntelligenceDashboard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScheduleDashboardResult | null>(null)
  const [selected, setSelected] = useState<ScheduleTask | null>(null)
  const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<'overview' | 'activities' | 'risk' | 'validation'>('overview')
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => {
      const fromUrl =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('projectId')
          : null
      setProjectId(readProjectCookie() || fromUrl)
    }
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  const handleAnalyze = (xml: string, fileName: string) => {
    setLoading(true)
    setSelected(null)
    setResult(null)
    try {
      const r = analyzeScheduleFromXml(xml, fileName, { analysisDate })
      setResult(r)
      setTab('overview')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'خطا در تحلیل')
    } finally {
      setLoading(false)
    }
  }

  const chartData = useMemo(() => {
    if (!result) return null
    const kpis = result.kpis
    return {
      status: [
        { name: 'شروع‌نشده', value: kpis.notStartedCount },
        { name: 'در حال انجام', value: kpis.inProgressCount },
        { name: 'تکمیل', value: kpis.completedCount },
        { name: 'نامشخص', value: kpis.unknownStatusCount },
      ].filter((d) => d.value > 0),
      risk: [
        { name: 'کم', value: result.schedule.tasks.filter((t) => t.riskLevel === 'low').length },
        { name: 'متوسط', value: result.schedule.tasks.filter((t) => t.riskLevel === 'medium').length },
        { name: 'زیاد', value: result.schedule.tasks.filter((t) => t.riskLevel === 'high').length },
        { name: 'خیلی زیاد', value: result.schedule.tasks.filter((t) => t.riskLevel === 'very-high').length },
      ].filter((d) => d.value > 0),
      deps: [
        { type: 'FS', count: kpis.fsCount },
        { type: 'SS', count: kpis.ssCount },
        { type: 'FF', count: kpis.ffCount },
        { type: 'SF', count: kpis.sfCount },
      ],
      longest: topActivitiesBy(result.schedule.tasks, 'durationMinutes', 10).map((t) => ({
        name: t.name.slice(0, 30),
        days: t.durationDays,
      })),
    }
  }, [result])

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <PageHeader
        title="تحلیل زمان‌بندی"
        description="داشبورد هوشمند زمان‌بندی ساخت — CPM قطعی، بدون هوش مصنوعی"
        actions={
          projectId ? (
            <ScheduleDownloadButton
              projectId={projectId}
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            />
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">تاریخ تحلیل</label>
          <Input type="date" value={analysisDate} onChange={(e) => setAnalysisDate(e.target.value)} />
        </div>
      </div>

      <ScheduleUpload onAnalyzed={handleAnalyze} loading={loading} />

      {loading ? (
        <p className="text-center text-muted-foreground py-8">در حال پردازش و محاسبه CPM...</p>
      ) : null}

      {result ? (
        <>
          {result.hasFatalErrors ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <ShieldAlert className="h-5 w-5 text-destructive inline ml-2" />
              خطاهای بحرانی در داده — نتایج CPM ممکن است نامعتبر باشد. بخش اعتبارسنجی را بررسی کنید.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-b pb-2">
            {(['overview', 'activities', 'risk', 'validation'] as const).map((t) => (
              <Button
                key={t}
                variant={tab === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTab(t)}
              >
                {t === 'overview' ? 'خلاصه' : t === 'activities' ? 'فعالیت‌ها' : t === 'risk' ? 'ریسک' : 'اعتبارسنجی'}
              </Button>
            ))}
            <div className="mr-auto">
              <ExportButtons
                projectId={projectId}
                onExportJson={() => {
                  const blob = new Blob([exportAnalysisJson(result)], { type: 'application/json' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'schedule-analysis.json'
                  a.click()
                }}
                onExportCsv={() => {
                  const blob = new Blob(
                    [exportTasksToCsv(result.schedule.tasks, result.schedule.minutesPerDay)],
                    { type: 'text/csv' }
                  )
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'activities.csv'
                  a.click()
                }}
              />
            </div>
          </div>

          {tab === 'overview' ? (
            <div className="space-y-6">
              <SectionCard title="خلاصه مدیریتی">
                <p className="text-sm leading-relaxed">{result.executiveSummary}</p>
              </SectionCard>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="فعالیت‌های اجرایی" value={result.kpis.totalLeafTasks.toLocaleString('fa-IR')} icon={<Network className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard label="مدت شبکه (روز)" value={result.kpis.calculatedProjectDurationDays.toLocaleString('fa-IR')} icon={<Calendar className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard label="بحرانی" value={result.kpis.criticalCount.toLocaleString('fa-IR')} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
                <KpiCard label="میانگین پیشرفت %" value={result.kpis.averagePercentComplete.toLocaleString('fa-IR')} icon={<Gauge className="h-4 w-4 text-muted-foreground" />} />
              </div>

              {chartData ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard title="وضعیت فعالیت‌ها">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={chartData.status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                          {chartData.status.map((_, i) => (
                            <Cell key={i} fill={['#94a3b8', '#3b82f6', '#22c55e', '#a855f7'][i % 4]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </SectionCard>
                  <SectionCard title="توزیع ریسک">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData.risk}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                  <SectionCard title="طولانی‌ترین فعالیت‌ها">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData.longest} layout="vertical">
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} />
                        <Tooltip />
                        <Bar dataKey="days" fill="#1a2330" />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                  <SectionCard title="نوع وابستگی‌ها">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData.deps}>
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#64748b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'activities' ? (
            <SectionCard title="همه فعالیت‌ها">
              <ActivitiesTable
                tasks={result.schedule.tasks}
                onSelect={setSelected}
                projectDurationDays={result.kpis.calculatedProjectDurationDays}
                minutesPerDay={result.schedule.minutesPerDay}
              />
            </SectionCard>
          ) : null}

          {tab === 'risk' ? (
            <div className="space-y-6">
              <SectionCard title="فعالیت‌های پرریسک">
                <ActivitiesTable
                  tasks={topActivitiesBy(result.schedule.tasks, 'riskScore', 50)}
                  onSelect={setSelected}
                  projectDurationDays={result.kpis.calculatedProjectDurationDays}
                  minutesPerDay={result.schedule.minutesPerDay}
                />
              </SectionCard>
              <SectionCard title="مسیر بحرانی">
                <p className="text-sm text-muted-foreground mb-2">
                  {result.cpm.criticalUids.length.toLocaleString('fa-IR')} فعالیت بحرانی —{' '}
                  {result.cpm.criticalChains.length.toLocaleString('fa-IR')} زنجیره
                </p>
                <ul className="text-sm space-y-1">
                  {result.cpm.criticalChains.map((chain, i) => (
                    <li key={i} className="font-mono text-xs">
                      {chain
                        .map((uid) => result.schedule.tasks.find((t) => t.uid === uid)?.name ?? uid)
                        .join(' → ')}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          ) : null}

          {tab === 'validation' ? (
            <SectionCard title="هشدارها و خطاها">
              <p className="text-sm mb-4">
                خطا: {result.kpis.validationErrorCount.toLocaleString('fa-IR')} — هشدار:{' '}
                {result.kpis.validationWarningCount.toLocaleString('fa-IR')}
              </p>
              <ul className="space-y-2 text-sm max-h-[400px] overflow-y-auto">
                {result.schedule.warnings.map((w, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded border p-2',
                      w.severity === 'error' && 'border-destructive/40 bg-destructive/5',
                      w.severity === 'warning' && 'border-amber-300/50 bg-amber-50',
                      w.severity === 'info' && 'border-muted'
                    )}
                  >
                    <Badge variant="outline" className="ml-2">{w.severity}</Badge>
                    {w.message}
                    {w.taskName ? ` — ${w.taskName}` : ''}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      <ActivityDrawer task={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
