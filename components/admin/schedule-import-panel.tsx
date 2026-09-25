'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActualStartPanel } from '@/components/admin/actual-start-panel'
import { ScheduleCatchUpPanel } from '@/components/admin/schedule-catch-up-panel'
import { ScheduleDateToolbar } from '@/components/schedule/schedule-date-toolbar'
import { SchedulePreviewTable } from '@/components/schedule/schedule-preview-table'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { useScheduleViewDate } from '@/hooks/useScheduleViewDate'
import { compareWbs } from '@/lib/schedule/wbs-utils'
import {
  publishScheduleViewSync,
  useScheduleFieldDrafts,
  useScheduleViewSync,
  type ScheduleTaskFieldDraft,
} from '@/lib/schedule/schedule-view-sync'
import { readProjectDailyProgress } from '@/lib/supervisor/daily-progress-storage'
import type { DailyProgressEntry } from '@/lib/supervisor/daily-report-activities'
import { applyWeightedParentRollup } from '@/lib/schedule/parent-progress-rollup'
import {
  mergeSupervisorProgressEntries,
  resolvePhysicalProgressPercent,
  schedulePhysicalPercent,
} from '@/lib/schedule/physical-progress'
import type { MspImportReportSummary, ProjectTask, ScheduleImport } from '@/types/schedule'
import { CalendarRange, CheckCircle2, FileUp, Loader2, AlertTriangle, ClipboardList } from 'lucide-react'
import { ScheduleDownloadButton } from '@/components/schedule/schedule-download-button'
import { useScheduleCalendar } from '@/hooks/useScheduleCalendar'

interface ScheduleImportPanelProps {
  projectId: string
  initialImports: ScheduleImport[]
  taskCount: number
  previewTasks: ProjectTask[]
  scheduleBaselineStart: string | null
  scheduleActualStart: string | null
  predecessorLabels: Record<string, string>
}

function statusBadge(status: ScheduleImport['status']) {
  if (status === 'completed') return <Badge className="bg-emerald-100 text-emerald-800">تکمیل‌شده</Badge>
  if (status === 'failed') return <Badge variant="destructive">ناموفق</Badge>
  if (status === 'processing') return <Badge variant="secondary">در حال پردازش</Badge>
  return <Badge variant="outline">در انتظار</Badge>
}

function sortTasks(
  tasks: ProjectTask[],
  _labels: Record<string, string> = {}
): ProjectTask[] {
  // Align with ویرایش برنامه: WBS hierarchy (parent before children)
  return [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code))
}

function applyFieldDrafts(
  tasks: ProjectTask[],
  drafts: Record<string, ScheduleTaskFieldDraft>
): ProjectTask[] {
  if (!drafts || Object.keys(drafts).length === 0) return tasks
  return tasks.map((t) => {
    const d = drafts[t.id]
    if (!d) return t
    const next: ProjectTask = { ...t }
    if (d.scheduleWeight !== undefined) {
      next.schedule_weight = d.scheduleWeight
      next.physical_weight = d.scheduleWeight
    }
    if (d.totalFloat !== undefined) {
      next.total_float_days = d.totalFloat
    }
    if (d.startDate) {
      next.start_current = `${d.startDate}T12:00:00.000Z`
      next.start_planned = `${d.startDate}T12:00:00.000Z`
    }
    if (d.finishDate) {
      next.finish_current = `${d.finishDate}T12:00:00.000Z`
      next.finish_planned = `${d.finishDate}T12:00:00.000Z`
    }
    if (d.quantity !== undefined) {
      next.quantity = d.quantity
      next.schedule_quantity = d.quantity
    }
    if (d.unitPrice !== undefined) {
      next.unit_price = d.unitPrice
    }
    if (d.uom !== undefined) {
      next.uom = d.uom
      next.schedule_uom = d.uom
    }
    if (d.quantityCertainty !== undefined) {
      next.quantity_certainty = d.quantityCertainty
    }
    return next
  })
}

/** Overlay supervisor daily-report % onto preview rows (matches ویرایش برنامه). */
function applySupervisorPhysicalProgress(
  tasks: ProjectTask[],
  entries: DailyProgressEntry[]
): ProjectTask[] {
  if (tasks.length === 0) return tasks
  const resolved = tasks.map((task) => ({
    task,
    percent: resolvePhysicalProgressPercent(task.id, schedulePhysicalPercent(task), entries),
  }))
  const rollup = applyWeightedParentRollup(
    resolved.map(({ task, percent }) => ({
      id: task.id,
      wbs: task.wbs_code,
      name: task.name,
      weight:
        task.schedule_weight != null && Number.isFinite(Number(task.schedule_weight))
          ? Number(task.schedule_weight)
          : null,
      percent: percent ?? 0,
    }))
  )
  return resolved.map(({ task, percent }) => {
    const shown = rollup.parentIds.has(task.id) ? rollup.percents[task.id] ?? percent : percent
    if (shown == null) return task
    return {
      ...task,
      percent_complete: shown,
      physical_percent_complete: shown,
    }
  })
}

export function ScheduleImportPanel({
  projectId,
  initialImports,
  taskCount: initialTaskCount,
  previewTasks,
  scheduleBaselineStart,
  scheduleActualStart: initialActualStart,
  predecessorLabels: initialPredecessorLabels,
}: ScheduleImportPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sendScheduleActive = searchParams.get('section') === 'send-schedule'
  const { viewDate, setViewDate, resetToToday } = useScheduleViewDate()
  const { setCalendar } = useScheduleCalendar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [previewReport, setPreviewReport] = useState<MspImportReportSummary | null>(null)
  const [previewMeta, setPreviewMeta] = useState<{
    tasks_found: number
    dependencies_found: number
    file_name: string
  } | null>(null)
  const [progressEpoch, setProgressEpoch] = useState(0)
  const [savedProgressEntries, setSavedProgressEntries] = useState<DailyProgressEntry[]>([])

  const [tasks, setTasks] = useState(() => sortTasks(previewTasks, initialPredecessorLabels))
  const [taskCount, setTaskCount] = useState(initialTaskCount)
  const [predecessorLabels, setPredecessorLabels] = useState(initialPredecessorLabels)
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, ScheduleTaskFieldDraft>>({})
  const [actualStart, setActualStart] = useState(initialActualStart)
  const [draftStart, setDraftStart] = useState<string | null>(null)
  const [baselineStart, setBaselineStart] = useState(scheduleBaselineStart)
  const localRescheduleRef = useRef(false)
  const clientPreviewEpochRef = useRef(0)

  const reloadPreview = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(
        `/api/schedule/preview?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'بارگذاری برنامه ناموفق بود')
      localRescheduleRef.current = false
      clientPreviewEpochRef.current = Date.now()
      setTasks(sortTasks((data.tasks ?? []) as ProjectTask[], data.predecessorLabels ?? {}))
      setTaskCount(Number(data.count) || 0)
      setPredecessorLabels((data.predecessorLabels ?? {}) as Record<string, string>)
      if (data.scheduleBaselineStart !== undefined) {
        setBaselineStart(data.scheduleBaselineStart ?? null)
      }
      if (data.scheduleActualStart !== undefined) {
        setActualStart(data.scheduleActualStart ?? null)
      }
      setProgressEpoch((n) => n + 1)
    } catch {
      /* keep current snapshot */
    }
  }, [projectId])

  useScheduleViewSync(
    projectId,
    () => {
      void reloadPreview()
      router.refresh()
    },
    { active: sendScheduleActive }
  )

  useScheduleFieldDrafts(projectId, setFieldDrafts)

  useEffect(() => {
    setCalendar('jalali')
  }, [setCalendar])

  useEffect(() => {
    const onDaily = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (detail?.projectId && detail.projectId !== projectId) return
      setProgressEpoch((n) => n + 1)
      if (sendScheduleActive) void reloadPreview()
    }
    window.addEventListener('sitepilot-daily-progress-updated', onDaily)
    return () => {
      window.removeEventListener('sitepilot-daily-progress-updated', onDaily)
    }
  }, [projectId, reloadPreview, sendScheduleActive])

  useEffect(() => {
    if (!projectId) {
      setSavedProgressEntries([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (!res.ok || cancelled) return
        const updates = Array.isArray(data.updates) ? data.updates : []
        setSavedProgressEntries(
          updates.map((row: Record<string, unknown>) => ({
            activityId: String(row.task_id ?? ''),
            reportDate: String(row.progress_date ?? '').slice(0, 10),
            percentComplete: Number(row.percent_complete) || 0,
          }))
        )
      } catch {
        /* stored schedule percent still applies */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, progressEpoch])

  useEffect(() => {
    clientPreviewEpochRef.current = 0
  }, [projectId])

  useEffect(() => {
    if (localRescheduleRef.current) return
    // After a client reload, ignore stale RSC props from router.refresh()
    if (clientPreviewEpochRef.current > 0) return
    setTasks(sortTasks(previewTasks, predecessorLabels))
  }, [previewTasks, predecessorLabels])

  useEffect(() => {
    setTaskCount(initialTaskCount)
  }, [initialTaskCount])

  useEffect(() => {
    setPredecessorLabels(initialPredecessorLabels)
  }, [initialPredecessorLabels])

  useEffect(() => {
    setActualStart(initialActualStart)
  }, [initialActualStart])

  useEffect(() => {
    setBaselineStart(scheduleBaselineStart)
  }, [scheduleBaselineStart])

  const displayTasks = useMemo(() => {
    const base =
      tasks.length > 0
        ? sortTasks(tasks, predecessorLabels)
        : sortTasks(previewTasks, predecessorLabels)
    const local = projectId ? readProjectDailyProgress(projectId).entries : []
    const withSupervisor = applySupervisorPhysicalProgress(
      base,
      mergeSupervisorProgressEntries(savedProgressEntries, local)
    )
    return applyFieldDrafts(withSupervisor, fieldDrafts)
    // progressEpoch forces re-read of localStorage after supervisor save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, previewTasks, predecessorLabels, fieldDrafts, projectId, progressEpoch, savedProgressEntries])
  const hasSchedule = taskCount > 0 || displayTasks.length > 0
  const latestImportId =
    initialImports.find((item) => item.status === 'completed')?.id ?? null

  /** Banner reflects applied start, or draft selection before first apply. */
  const bannerStart = actualStart ?? draftStart ?? baselineStart

  const handleDraftChange = useCallback((iso: string) => {
    setDraftStart(iso)
  }, [])

  const handleRescheduled = useCallback(
    (payload: { tasks: ProjectTask[]; actualStart: string }) => {
      localRescheduleRef.current = true
      if (payload.tasks.length > 0) {
        setTasks(sortTasks(payload.tasks, predecessorLabels))
      }
      setActualStart(payload.actualStart)
      setDraftStart(null)
    },
    [predecessorLabels]
  )

  async function handlePreview() {
    if (!file) {
      setError('ابتدا یک فایل MSP XML انتخاب کنید.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError('فقط فایل‌های XML پشتیبانی می‌شوند. در Microsoft Project: File → Save As → XML.')
      return
    }

    setLoading(true)
    setError(null)
    setImportSuccess(null)
    setPreviewReport(null)
    setPreviewMeta(null)

    try {
      const formData = new FormData()
      formData.append('project_id', projectId)
      formData.append('file', file)
      formData.append('dry_run', '1')

      const response = await fetch('/api/schedule/import-msp', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'بررسی فایل ناموفق بود')

      setPreviewReport((data.report ?? null) as MspImportReportSummary | null)
      setPreviewMeta({
        tasks_found: Number(data.tasks_found) || 0,
        dependencies_found: Number(data.dependencies_found) || 0,
        file_name: String(data.file_name || file.name),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بررسی فایل ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmImport() {
    if (!file || !previewReport || previewReport.blocked) return

    setConfirming(true)
    setError(null)
    setImportSuccess(null)

    try {
      const formData = new FormData()
      formData.append('project_id', projectId)
      formData.append('file', file)
      formData.append('confirm', '1')

      const response = await fetch('/api/schedule/import-msp', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ورود فایل ناموفق بود')

      setImportSuccess(
        `${data.tasks_imported} فعالیت و ${data.dependencies_imported} وابستگی وارد شد. برنامه قبلی پاک شد.`
      )
      setPreviewReport(null)
      setPreviewMeta(null)
      localRescheduleRef.current = false
      setTasks([])
      setBaselineStart(data.baseline_start ?? null)
      setActualStart(null)
      setDraftStart(null)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود فایل ناموفق بود')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-none">
      <Card className="shadow-card border-primary/20">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">ورود برنامه MSP</CardTitle>
                <CardDescription>
                  ابتدا فایل را بررسی کنید؛ گزارش Import نمایش داده می‌شود. پس از تأیید، برنامه قبلی
                  کاملاً جایگزین می‌شود.
                </CardDescription>
              </div>
            </div>
            {hasSchedule ? (
              <ScheduleDownloadButton
                projectId={projectId}
                importId={latestImportId}
                originalOnly
                variant="outline"
                size="sm"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              در Microsoft Project: <strong>File → Save As → XML</strong> (نه .mpp)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreviewReport(null)
                setPreviewMeta(null)
                setImportSuccess(null)
                setError(null)
              }}
              className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file ? <p className="text-xs text-muted-foreground">انتخاب‌شده: {file.name}</p> : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {importSuccess ? (
            <p className="text-sm text-emerald-700 flex items-center gap-2 bg-emerald-50 rounded-md px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {importSuccess}
            </p>
          ) : null}

          {previewReport ? (
            <div
              className={`rounded-lg border p-4 space-y-3 text-sm ${
                previewReport.blocked
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-amber-200 bg-amber-50/60'
              }`}
            >
              <div className="flex items-start gap-2">
                <ClipboardList className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">گزارش بررسی Import</p>
                  {previewMeta ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {previewMeta.file_name} · {previewMeta.tasks_found} فعالیت ·{' '}
                      {previewMeta.dependencies_found} وابستگی
                    </p>
                  ) : null}
                </div>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                {previewReport.summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {previewReport.issues.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border-t pt-2">
                  {previewReport.issues.map((issue, idx) => (
                    <p
                      key={`${issue.code}-${idx}`}
                      className={
                        issue.severity === 'error'
                          ? 'text-destructive text-xs'
                          : 'text-amber-900 text-xs'
                      }
                    >
                      {issue.severity === 'error' ? 'خطا: ' : 'هشدار: '}
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700">مشکل مسدودکننده یا هشداری یافت نشد.</p>
              )}
              {previewReport.blocked ? (
                <p className="text-xs text-destructive font-medium">
                  به‌خاطر حلقه در وابستگی‌ها، ورود قطعی ممکن نیست. فایل را در MSP اصلاح کنید.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  در صورت تأیید، برنامه قبلی پروژه کاملاً جایگزین می‌شود.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handlePreview} disabled={loading || confirming || !file}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  در حال بررسی...
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  بررسی فایل
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirmImport}
              disabled={
                confirming ||
                loading ||
                !file ||
                !previewReport ||
                Boolean(previewReport.blocked)
              }
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  در حال ورود قطعی...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  تأیید و ورود قطعی
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ScheduleDateToolbar
        viewDate={viewDate}
        onViewDateChange={setViewDate}
        onResetToday={resetToToday}
      />

      {bannerStart ? (
        <p className="text-sm rounded-lg border bg-primary/5 px-4 py-3">
          <span className="text-muted-foreground">
            {actualStart ? 'شروع واقعی: ' : 'شروع پروژه: '}
          </span>
          <strong className="text-primary tabular-nums">
            <FormattedDate value={bannerStart} />
          </strong>
          {!actualStart && draftStart ? (
            <span className="text-muted-foreground text-xs ms-2">(در انتظار اعمال)</span>
          ) : null}
        </p>
      ) : null}

      {hasSchedule ? (
        <ActualStartPanel
          projectId={projectId}
          baselineStart={baselineStart}
          actualStart={actualStart}
          taskCount={taskCount}
          onDraftChange={handleDraftChange}
          onRescheduled={handleRescheduled}
        />
      ) : null}

      {hasSchedule && actualStart ? (
        <ScheduleCatchUpPanel
          projectId={projectId}
          tasks={displayTasks}
          actualStart={actualStart}
          scheduleVersion={latestImportId}
          onTasksUpdated={(next) => {
            localRescheduleRef.current = true
            setTasks(sortTasks(next, predecessorLabels))
            publishScheduleViewSync(projectId)
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold">{taskCount}</p>
            <p className="text-xs text-muted-foreground">فعالیت‌های برنامه</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold">{initialImports.filter((i) => i.status === 'completed').length}</p>
            <p className="text-xs text-muted-foreground">ورودهای موفق</p>
          </CardContent>
        </Card>
      </div>

      {displayTasks.length > 0 ? (
        <Card className="w-full max-w-none shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-3 px-4 py-3">
            <CardTitle className="text-base">
              پیش‌نمایش برنامه ({displayTasks.length}
              {taskCount > displayTasks.length ? ` از ${taskCount}` : ''})
            </CardTitle>
            <CardDescription>
              تیتر عمودی · همه ستون‌ها · خط بین ستون‌ها = عرض · ؟ = توضیح · «تنظیم خودکار عرض»
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-0 w-full">
            <SchedulePreviewTable
              tasks={displayTasks}
              predecessorLabels={predecessorLabels}
              statusAsOf={viewDate}
            />
          </CardContent>
        </Card>
      ) : null}

      {initialImports.length > 0 ? (
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-base">تاریخچه ورود</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {initialImports.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{item.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <FormattedDate value={item.created_at} dateTime />
                    {item.status === 'completed'
                      ? ` · ${item.tasks_imported} فعالیت، ${item.dependencies_imported} پیوند`
                      : ''}
                    {item.error_message ? ` · ${item.error_message}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'completed' ? (
                    <ScheduleDownloadButton
                      projectId={projectId}
                      importId={item.id}
                      fileName={item.file_name}
                      originalOnly
                      variant="ghost"
                      size="sm"
                      label="دانلود"
                    />
                  ) : null}
                  {statusBadge(item.status)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
