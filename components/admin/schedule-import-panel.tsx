'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import type { ProjectTask, ScheduleImport } from '@/types/schedule'
import { CalendarRange, CheckCircle2, FileUp, Loader2, AlertTriangle } from 'lucide-react'
import { ScheduleDownloadButton } from '@/components/schedule/schedule-download-button'

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
    }
    if (d.startDate) {
      next.start_current = `${d.startDate}T12:00:00.000Z`
      next.start_planned = `${d.startDate}T12:00:00.000Z`
    }
    if (d.finishDate) {
      next.finish_current = `${d.finishDate}T12:00:00.000Z`
      next.finish_planned = `${d.finishDate}T12:00:00.000Z`
    }
    return next
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
  const { viewDate, setViewDate, resetToToday } = useScheduleViewDate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  const [tasks, setTasks] = useState(() => sortTasks(previewTasks, initialPredecessorLabels))
  const [taskCount, setTaskCount] = useState(initialTaskCount)
  const [predecessorLabels, setPredecessorLabels] = useState(initialPredecessorLabels)
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, ScheduleTaskFieldDraft>>({})
  const [actualStart, setActualStart] = useState(initialActualStart)
  const [draftStart, setDraftStart] = useState<string | null>(null)
  const [baselineStart, setBaselineStart] = useState(scheduleBaselineStart)
  const localRescheduleRef = useRef(false)

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
      setTasks(sortTasks((data.tasks ?? []) as ProjectTask[], data.predecessorLabels ?? {}))
      setTaskCount(Number(data.count) || 0)
      setPredecessorLabels((data.predecessorLabels ?? {}) as Record<string, string>)
      if (data.scheduleBaselineStart !== undefined) {
        setBaselineStart(data.scheduleBaselineStart ?? null)
      }
      if (data.scheduleActualStart !== undefined) {
        setActualStart(data.scheduleActualStart ?? null)
      }
    } catch {
      /* keep current snapshot */
    }
  }, [projectId])

  useScheduleViewSync(projectId, () => {
    void reloadPreview()
    router.refresh()
  })

  useScheduleFieldDrafts(projectId, setFieldDrafts)

  useEffect(() => {
    if (localRescheduleRef.current) return
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
    return applyFieldDrafts(base, fieldDrafts)
  }, [tasks, previewTasks, predecessorLabels, fieldDrafts])
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

  async function handleImport() {
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

    try {
      const formData = new FormData()
      formData.append('project_id', projectId)
      formData.append('file', file)

      const response = await fetch('/api/schedule/import-msp', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ورود فایل ناموفق بود')

      setImportSuccess(
        `${data.tasks_imported} فعالیت و ${data.dependencies_imported} وابستگی وارد شد. برنامه قبلی پاک شد.`
      )
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
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
                  فایل XML جدید جایگزین کامل برنامه قبلی می‌شود (فعالیت‌ها، زیرشاخه‌های کارگاه، پیشرفت ثبت‌شده و هشدارهای زمان‌بندی پاک می‌شوند).
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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

          <Button type="button" onClick={handleImport} disabled={loading || !file}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                در حال ورود...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                ورود برنامه
              </>
            )}
          </Button>
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
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-base">
              پیش‌نمایش برنامه ({displayTasks.length}
              {taskCount > displayTasks.length ? ` از ${taskCount}` : ''})
            </CardTitle>
            <CardDescription className="text-xs">
              مرتب‌سازی بر اساس WBS (مادر قبل از فرزندان) · وزن سرشاخه = جمع فرزندان · همان داده‌های
              ذخیره‌شده در ویرایش برنامه
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-0">
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
