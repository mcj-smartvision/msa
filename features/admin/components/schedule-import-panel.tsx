/**
 * @file features/admin/components/schedule-import-panel.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (schedule-import-panel)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/components/ui/button, shared/components/ui/card, shared/components/ui/badge, features/admin/components/actual-start-panel, features/admin/components/schedule-catch-up-panel, features/schedule/components/schedule-date-toolbar, features/schedule/components/schedule-preview-table, features/schedule/components/formatted-date, features/schedule/hooks/use-schedule-view-date, features/schedule/lib/wbs-utils, features/admin/config
 */

'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { ActualStartPanel } from '@/features/admin/components/actual-start-panel'
import { ScheduleCatchUpPanel } from '@/features/admin/components/schedule-catch-up-panel'
import { ScheduleDateToolbar } from '@/features/schedule/components/schedule-date-toolbar'
import { SchedulePreviewTable } from '@/features/schedule/components/schedule-preview-table'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { useScheduleViewDate } from '@/features/schedule/hooks/use-schedule-view-date'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import {
publishScheduleViewSync,
useScheduleFieldDrafts,
useScheduleViewSync,
type ScheduleTaskFieldDraft,
} from '@/features/schedule/lib/schedule-view-sync'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import type { DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { applyWeightedParentRollup } from '@/features/schedule/lib/parent-progress-rollup'
import {
mergeSupervisorProgressEntries,
resolvePhysicalProgressPercent,
schedulePhysicalPercent,
} from '@/features/schedule/lib/physical-progress'
import { useStoreProgress, withStoreEntries } from '@/features/project-store/use-store-progress'
import type { MspImportReportSummary, ProjectTask, ScheduleImport } from '@/shared/types/schedule'
import { CalendarRange, CheckCircle2, FileUp, Loader2, AlertTriangle, ClipboardList } from 'lucide-react'
import { ScheduleDownloadButton } from '@/features/schedule/components/schedule-download-button'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { ADMIN_SCHEDULE_IMPORT_COPY as copy } from '@/features/admin/config'

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
  if (status === 'completed') return <Badge className="bg-emerald-100 text-emerald-800">{copy.statusCompleted}</Badge>
  if (status === 'failed') return <Badge variant="destructive">{copy.statusFailed}</Badge>
  if (status === 'processing') return <Badge variant="secondary">{copy.statusProcessing}</Badge>
  return <Badge variant="outline">{copy.statusPending}</Badge>
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
  const storeProgress = useStoreProgress(projectId)
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
      if (!res.ok) throw new Error(data.error || copy.loadFailed)
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
      withStoreEntries(storeProgress.entries, mergeSupervisorProgressEntries(savedProgressEntries, local))
    )
    return applyFieldDrafts(withSupervisor, fieldDrafts)
    // progressEpoch forces re-read of localStorage after supervisor save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, previewTasks, predecessorLabels, fieldDrafts, projectId, progressEpoch, savedProgressEntries, storeProgress.entries])
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
      setError(copy.pickXmlFirst)
      return
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError(copy.xmlOnly)
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
      if (!response.ok) throw new Error(data.error || copy.previewFailed)

      setPreviewReport((data.report ?? null) as MspImportReportSummary | null)
      setPreviewMeta({
        tasks_found: Number(data.tasks_found) || 0,
        dependencies_found: Number(data.dependencies_found) || 0,
        file_name: String(data.file_name || file.name),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.previewFailed)
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
      if (!response.ok) throw new Error(data.error || copy.importFailed)

      setImportSuccess(copy.importSuccess(data.tasks_imported, data.dependencies_imported))
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
      setError(err instanceof Error ? err.message : copy.importFailed)
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
                <CardTitle className="text-base">{copy.title}</CardTitle>
                <CardDescription>
                  {copy.description}
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
              {copy.mspSaveHintBefore}<strong>{copy.mspSaveHintCode}</strong>{copy.mspSaveHintAfter}
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
            {file ? <p className="text-xs text-muted-foreground">{copy.selectedPrefix}{file.name}</p> : null}
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
                  <p className="font-medium">{copy.previewReportTitle}</p>
                  {previewMeta ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {copy.previewMetaLine(
                        previewMeta.file_name,
                        previewMeta.tasks_found,
                        previewMeta.dependencies_found
                      )}
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
                      {issue.severity === 'error' ? copy.errorPrefix : copy.warnPrefix}
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700">{copy.noIssues}</p>
              )}
              {previewReport.blocked ? (
                <p className="text-xs text-destructive font-medium">
                  {copy.blockedCycle}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {copy.confirmReplace}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handlePreview} disabled={loading || confirming || !file}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {copy.previewing}
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  {copy.previewFile}
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
                  {copy.confirming}
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  {copy.confirmImport}
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
            {actualStart ? copy.actualStartPrefix : copy.projectStartPrefix}
          </span>
          <strong className="text-primary tabular-nums">
            <FormattedDate value={bannerStart} />
          </strong>
          {!actualStart && draftStart ? (
            <span className="text-muted-foreground text-xs ms-2">{copy.pendingApply}</span>
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
            <p className="text-xs text-muted-foreground">{copy.taskCountLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold">{initialImports.filter((i) => i.status === 'completed').length}</p>
            <p className="text-xs text-muted-foreground">{copy.successfulImports}</p>
          </CardContent>
        </Card>
      </div>

      {displayTasks.length > 0 ? (
        <Card className="w-full max-w-none shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-3 px-4 py-3">
            <CardTitle className="text-base">
              {copy.previewTitle(displayTasks.length}
              {taskCount > displayTasks.length ? copy.ofTotal(taskCount) : ''}
              {copy.previewTitleEnd}
            </CardTitle>
            <CardDescription>
              {copy.previewHint}
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
            <CardTitle className="text-base">{copy.historyTitle}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {initialImports.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{item.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <FormattedDate value={item.created_at} dateTime />
                    {item.status === 'completed'
                      ? copy.historyCompleted(item.tasks_imported, item.dependencies_imported)
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
                      label={copy.download}
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
