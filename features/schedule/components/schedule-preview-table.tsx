'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { AlertCircle, GitBranch, HelpCircle, Loader2, Users } from 'lucide-react'
import { ScheduleTaskRow } from '@/features/schedule/components/schedule-task-row'
import { applyParentWeightSum } from '@/features/schedule/lib/parent-weight-rollup'
import { applyParentDurationSum } from '@/features/schedule/lib/parent-duration-rollup'
import {
SCHEDULE_PREVIEW_WIDTHS_KEY,
expandWidthsToFill,
fitScheduleColumnWidths,
loadSchedulePreviewWidths,
resolveVisibleScheduleColumns,
stickyOffsetsFromOrder,
type SchedulePreviewColKey,
} from '@/features/schedule/lib/schedule-preview-columns'
import { compareWbs, wbsDepth } from '@/features/schedule/lib/wbs-utils'
import { publishScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import { todayIso } from '@/features/schedule/lib/task-view-date'
import type { ProjectTask } from '@/shared/types/schedule'
import { cn } from '@/shared/lib/utils'

/** Distinct fills per top-level WBS group: strong title, softer children. */
const WBS_GROUP_COLORS = [
  { header: 'bg-sky-100', child: 'bg-sky-50/40' },
  { header: 'bg-amber-100', child: 'bg-amber-50/40' },
  { header: 'bg-emerald-100', child: 'bg-emerald-50/40' },
  { header: 'bg-violet-100', child: 'bg-violet-50/40' },
  { header: 'bg-rose-100', child: 'bg-rose-50/40' },
  { header: 'bg-cyan-100', child: 'bg-cyan-50/40' },
  { header: 'bg-lime-100', child: 'bg-lime-50/40' },
  { header: 'bg-orange-100', child: 'bg-orange-50/40' },
  { header: 'bg-fuchsia-100', child: 'bg-fuchsia-50/40' },
  { header: 'bg-teal-100', child: 'bg-teal-50/40' },
  { header: 'bg-indigo-100', child: 'bg-indigo-50/40' },
  { header: 'bg-yellow-100', child: 'bg-yellow-50/40' },
] as const

type ContractorOption = { id: string; name: string }
type ContractorAssignment = {
  id: string
  subcontractor_id: string | null
  resolved_subcontractor_id: string | null
}

function rootWbsKey(wbs: string | null | undefined): string {
  const raw = wbs?.trim()
  if (!raw) return ''
  return raw.split('.')[0] ?? raw
}

interface SchedulePreviewTableProps {
  tasks: ProjectTask[]
  predecessorLabels?: Record<string, string>
  statusAsOf?: string
  className?: string
}

export function SchedulePreviewTable({
  tasks,
  predecessorLabels = {},
  statusAsOf = todayIso(),
  className,
}: SchedulePreviewTableProps) {
  const [helpParentId, setHelpParentId] = useState<string | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)
  const [contractors, setContractors] = useState<ContractorOption[]>([])
  const [contractorAssignments, setContractorAssignments] = useState<
    Record<string, ContractorAssignment>
  >({})
  const [contractorError, setContractorError] = useState<string | null>(null)
  const [savingContractorIds, setSavingContractorIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkContractorId, setBulkContractorId] = useState('')
  const [contractorView, setContractorView] = useState<'schedule' | 'review'>('schedule')
  const [reviewContractorId, setReviewContractorId] = useState('all')
  const [headerHelpKey, setHeaderHelpKey] = useState<SchedulePreviewColKey | null>(null)
  const [widths, setWidths] = useState<Record<SchedulePreviewColKey, number> | null>(null)
  const [userResized, setUserResized] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    key: SchedulePreviewColKey
    startX: number
    startW: number
  } | null>(null)

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code)),
    [tasks]
  )
  const projectId = sorted[0]?.project_id ?? ''

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(
          `/api/schedule/contractors?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'بارگذاری پیمانکاران ناموفق بود')
        if (cancelled) return
        setContractors((data.contractors ?? []) as ContractorOption[])
        setContractorAssignments(
          Object.fromEntries(
            ((data.assignments ?? []) as ContractorAssignment[]).map((item) => [item.id, item])
          )
        )
        publishScheduleViewSync(projectId)
        setContractorError(null)
      } catch (error) {
        if (!cancelled) {
          setContractorError(
            error instanceof Error ? error.message : 'بارگذاری پیمانکاران ناموفق بود'
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const assignContractor = useCallback(
    async (taskIds: string[], contractorId: string | null) => {
      if (!projectId || taskIds.length === 0) return
      setSavingContractorIds((current) => new Set([...current, ...taskIds]))
      setContractorError(null)
      try {
        const packageIds = taskIds.filter((id) => {
          const row = sorted.find((task) => task.id === id)
          return row?.row_origin === 'package'
        })
        const mspTaskIds = taskIds.filter((id) => !packageIds.includes(id))

        if (mspTaskIds.length > 0) {
          const response = await fetch('/api/schedule/contractors', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, taskIds: mspTaskIds, contractorId }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'ذخیره پیمانکار ناموفق بود')
          setContractorAssignments((current) => ({
            ...current,
            ...Object.fromEntries(
              ((data.assignments ?? []) as ContractorAssignment[]).map((item) => [
                item.id,
                item,
              ])
            ),
          }))
        }

        for (const packageId of packageIds) {
          const response = await fetch(`/api/workshop/packages/${packageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subcontractorId: contractorId }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'ذخیره پیمانکار زیرشاخه ناموفق بود')
          setContractorAssignments((current) => ({
            ...current,
            [packageId]: {
              id: packageId,
              subcontractor_id: contractorId,
              resolved_subcontractor_id: contractorId,
            },
          }))
        }

        publishScheduleViewSync(projectId)
      } catch (error) {
        setContractorError(
          error instanceof Error ? error.message : 'ذخیره پیمانکار ناموفق بود'
        )
      } finally {
        setSavingContractorIds((current) => {
          const next = new Set(current)
          taskIds.forEach((id) => next.delete(id))
          return next
        })
      }
    },
    [projectId, sorted]
  )

  const selectTask = useCallback(
    (
      index: number,
      taskId: string,
      modifiers?: { shiftKey: boolean; toggleKey: boolean }
    ) => {
      setSelectedTaskIds((current) => {
        if (modifiers?.shiftKey && lastSelectedIndexRef.current != null) {
          const from = Math.min(lastSelectedIndexRef.current, index)
          const to = Math.max(lastSelectedIndexRef.current, index)
          const next = modifiers.toggleKey ? new Set(current) : new Set<string>()
          for (let i = from; i <= to; i += 1) next.add(sorted[i]!.id)
          return next
        }
        if (modifiers?.toggleKey) {
          const next = new Set(current)
          if (next.has(taskId)) next.delete(taskId)
          else next.add(taskId)
          return next
        }
        return current.size === 1 && current.has(taskId)
          ? new Set<string>()
          : new Set([taskId])
      })
      lastSelectedIndexRef.current = index
    },
    [sorted]
  )

  const visibleColumns = useMemo(
    () => resolveVisibleScheduleColumns(sorted, predecessorLabels),
    [sorted, predecessorLabels]
  )

  // Auto-fit to content whenever data changes (unless user already resized this session)
  useEffect(() => {
    if (userResized) return
    const fitted = fitScheduleColumnWidths(visibleColumns, sorted, predecessorLabels)
    const saved = loadSchedulePreviewWidths()
    setWidths(saved ?? fitted)
  }, [sorted, predecessorLabels, visibleColumns, userResized])

  useEffect(() => {
    if (!widths) return
    try {
      localStorage.setItem(SCHEDULE_PREVIEW_WIDTHS_KEY, JSON.stringify(widths))
    } catch {
      /* ignore */
    }
  }, [widths])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && Number.isFinite(w)) setContainerWidth(Math.floor(w))
    })
    ro.observe(el)
    setContainerWidth(Math.floor(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    function onMove(e: globalThis.MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const next = Math.max(22, Math.round(drag.startW + (drag.startX - e.clientX)))
      setUserResized(true)
      setWidths((prev) => {
        if (!prev) return prev
        const clamped = Math.min(400, next)
        return prev[drag.key] === clamped ? prev : { ...prev, [drag.key]: clamped }
      })
    }
    function onUp() {
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startResize = useCallback(
    (key: SchedulePreviewColKey, e: MouseEvent) => {
      if (!widths) return
      e.preventDefault()
      e.stopPropagation()
      setHeaderHelpKey(null)
      dragRef.current = { key, startX: e.clientX, startW: widths[key] }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [widths]
  )

  const resetAutoFit = useCallback(() => {
    setUserResized(false)
    localStorage.removeItem(SCHEDULE_PREVIEW_WIDTHS_KEY)
    setWidths(fitScheduleColumnWidths(visibleColumns, sorted, predecessorLabels))
  }, [visibleColumns, sorted, predecessorLabels])

  const baseWidths = widths ?? fitScheduleColumnWidths(visibleColumns, sorted, predecessorLabels)

  const displayWidths = useMemo(
    () => expandWidthsToFill(visibleColumns, baseWidths, containerWidth),
    [visibleColumns, baseWidths, containerWidth]
  )

  const offsets = useMemo(
    () => stickyOffsetsFromOrder(visibleColumns, displayWidths),
    [visibleColumns, displayWidths]
  )

  const tableWidth = useMemo(
    () => visibleColumns.reduce((s, c) => s + displayWidths[c.key], 0),
    [visibleColumns, displayWidths]
  )

  const weightRollup = useMemo(() => {
    const nodes = sorted.map((t) => ({
      id: t.id,
      wbs: t.wbs_code?.trim() || null,
      name: t.name,
      weight:
        t.physical_weight != null && Number.isFinite(Number(t.physical_weight))
          ? Number(t.physical_weight)
          : t.schedule_weight != null && Number.isFinite(Number(t.schedule_weight))
            ? Number(t.schedule_weight)
            : null,
    }))
    return applyParentWeightSum(nodes)
  }, [sorted])

  const durationRollup = useMemo(() => {
    const nodes = sorted.map((t) => ({
      id: t.id,
      wbs: t.wbs_code?.trim() || null,
      durationDays: t.duration_days ?? null,
      isSummary: Boolean(t.is_summary),
    }))
    return applyParentDurationSum(nodes)
  }, [sorted])

  /** Map top-level WBS → distinct title/child color pair. */
  const groupColorsByRoot = useMemo(() => {
    const map = new Map<string, (typeof WBS_GROUP_COLORS)[number]>()
    let i = 0
    for (const t of sorted) {
      const key = rootWbsKey(t.wbs_code)
      if (!key || map.has(key)) continue
      map.set(key, WBS_GROUP_COLORS[i % WBS_GROUP_COLORS.length]!)
      i += 1
    }
    return map
  }, [sorted])

  const projectWeightCheck = useMemo(() => {
    const contributorIds = new Set<string>()
    let sum = 0
    for (const t of sorted) {
      if (wbsDepth(t.wbs_code) !== 0) continue
      contributorIds.add(t.id)
      const rolled = weightRollup.weights[t.id]
      const w =
        rolled != null && Number.isFinite(Number(rolled))
          ? Number(rolled)
          : t.physical_weight != null && Number.isFinite(Number(t.physical_weight))
            ? Number(t.physical_weight)
            : t.schedule_weight != null && Number.isFinite(Number(t.schedule_weight))
              ? Number(t.schedule_weight)
              : 0
      if (w > 0) sum += w
    }
    sum = Math.round(sum * 100) / 100
    const ok = contributorIds.size === 0 || Math.abs(sum - 100) < 0.05
    return {
      sum,
      ok,
      contributorIds,
      gap: Math.round((100 - sum) * 100) / 100,
    }
  }, [sorted, weightRollup])

  const contractorNameById = useMemo(
    () => new Map(contractors.map((contractor) => [contractor.id, contractor.name])),
    [contractors]
  )

  const reviewTasks = useMemo(() => {
    const parentIds = new Set(
      sorted.map((task) => task.parent_id).filter((id): id is string => Boolean(id))
    )
    return sorted
      .filter((task) => !parentIds.has(task.id) && !task.is_summary)
      .filter((task) => {
        const assignment = contractorAssignments[task.id]
        const resolvedId = assignment
          ? assignment.resolved_subcontractor_id
          : (task.resolved_subcontractor_id ?? null)
        if (reviewContractorId === 'all') return true
        if (reviewContractorId === 'unassigned') return !resolvedId
        return resolvedId === reviewContractorId
      })
      .sort((a, b) => {
        const aResolved = contractorAssignments[a.id]
          ? contractorAssignments[a.id].resolved_subcontractor_id
          : a.resolved_subcontractor_id
        const bResolved = contractorAssignments[b.id]
          ? contractorAssignments[b.id].resolved_subcontractor_id
          : b.resolved_subcontractor_id
        if (Boolean(aResolved) !== Boolean(bResolved)) return aResolved ? 1 : -1
        return compareWbs(a.wbs_code, b.wbs_code)
      })
  }, [sorted, contractorAssignments, reviewContractorId])

  if (sorted.length === 0) return null

  return (
    <div className={cn('space-y-0 w-full', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2" dir="rtl">
        <div className="inline-flex rounded-md border bg-slate-50 p-0.5 text-[11px]">
          <button
            type="button"
            className={cn(
              'rounded px-3 py-1',
              contractorView === 'schedule' && 'bg-white font-semibold text-sky-800 shadow-sm'
            )}
            onClick={() => setContractorView('schedule')}
          >
            برنامه زمان‌بندی
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-3 py-1',
              contractorView === 'review' && 'bg-white font-semibold text-sky-800 shadow-sm'
            )}
            onClick={() => setContractorView('review')}
          >
            مرور تخصیص پیمانکاران
          </button>
        </div>
        {contractorView === 'review' ? (
          <select
            value={reviewContractorId}
            onChange={(event) => setReviewContractorId(event.target.value)}
            className="h-8 rounded-md border bg-white px-2 text-[11px]"
            aria-label="فیلتر پیمانکار"
          >
            <option value="all">همه پیمانکاران</option>
            <option value="unassigned">بدون پیمانکار</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {contractorError ? (
        <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900" dir="rtl">
          {contractorError}
        </div>
      ) : null}

      {contractorView === 'review' ? (
        <div className="max-h-[70vh] overflow-auto" dir="rtl">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr>
                <th className="border p-2 text-right">WBS</th>
                <th className="border p-2 text-right">فعالیت اجرایی</th>
                <th className="border p-2 text-right">پیمانکار نهایی</th>
                <th className="border p-2 text-center">نوع تخصیص</th>
              </tr>
            </thead>
            <tbody>
              {reviewTasks.map((task) => {
                const assignment = contractorAssignments[task.id]
                const directId = assignment
                  ? assignment.subcontractor_id
                  : (task.subcontractor_id ?? null)
                const resolvedId = assignment
                  ? assignment.resolved_subcontractor_id
                  : (task.resolved_subcontractor_id ?? null)
                return (
                  <tr
                    key={task.id}
                    className={cn(!resolvedId && 'bg-amber-100 font-semibold text-amber-950')}
                  >
                    <td className="border p-2 font-mono">{task.wbs_code ?? '—'}</td>
                    <td className="border p-2">{task.name}</td>
                    <td className="border p-2">
                      {resolvedId ? contractorNameById.get(resolvedId) ?? 'پیمانکار نامشخص' : 'بدون پیمانکار'}
                    </td>
                    <td className="border p-2 text-center">
                      {resolvedId && !directId ? (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <GitBranch className="h-3 w-3" />
                          ارثی
                        </span>
                      ) : resolvedId ? (
                        'مستقیم'
                      ) : (
                        'تخصیص‌نیافته'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {reviewTasks.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              فعالیتی مطابق این فیلتر وجود ندارد.
            </p>
          ) : null}
        </div>
      ) : (
        <>
      {!projectWeightCheck.ok ? (
        <div
          className="flex items-start gap-2 border-b border-red-300 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-800"
          role="alert"
          dir="rtl"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            خطای وزن‌دهی: جمع وزن سطح پروژه{' '}
            <strong className="tabular-nums">{projectWeightCheck.sum}</strong> باید{' '}
            <strong>100</strong> باشد
            {projectWeightCheck.gap !== 0 ? (
              <>
                {' '}
                (اختلاف{' '}
                <strong className="tabular-nums">
                  {projectWeightCheck.gap > 0 ? '+' : ''}
                  {projectWeightCheck.gap}
                </strong>
                )
              </>
            ) : null}
            .
          </span>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[10px] text-muted-foreground border-b bg-muted/10"
        dir="rtl"
      >
        <span>
          همهٔ {visibleColumns.length} ستون · تیتر عمودی · خط بین ستون‌ها = تغییر عرض · ؟ = توضیح
        </span>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-[10px] hover:bg-white"
          onClick={resetAutoFit}
        >
          تنظیم خودکار عرض
        </button>
      </div>

      <div
        ref={scrollRef}
        className="isolate overflow-x-auto w-full"
        onClick={() => setHeaderHelpKey(null)}
      >
        <table
          className="text-[11px] border-separate border-spacing-0 table-fixed border-t border-slate-300"
          style={{ width: Math.max(tableWidth, containerWidth || tableWidth) }}
        >
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.key} style={{ width: displayWidths[col.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-300">
              {visibleColumns.map((col) => {
                const stickyRight =
                  col.sticky === 'wbs'
                    ? offsets.wbs
                    : col.sticky === 'name'
                      ? offsets.name
                      : undefined
                const isWide = col.key === 'name' || col.key === 'status'
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'relative border-x-2 border-slate-400 bg-slate-200 p-0 align-bottom select-none',
                      col.sticky === 'wbs' && 'sticky z-20',
                      col.sticky === 'name' && 'sticky z-30 border-l-2 border-slate-500'
                    )}
                    style={
                      stickyRight != null
                        ? {
                            right: stickyRight,
                            width: displayWidths[col.key],
                            minWidth: displayWidths[col.key],
                            maxWidth: displayWidths[col.key],
                            height: isWide ? 88 : 112,
                            ...(col.sticky === 'name'
                              ? {
                                  boxShadow:
                                    '-1px 0 0 0 rgb(100, 116, 139), -6px 0 10px -4px rgba(15, 23, 42, 0.25)',
                                }
                              : null),
                          }
                        : { width: displayWidths[col.key], height: isWide ? 88 : 112 }
                    }
                  >
                    <div className="flex h-full flex-col items-center justify-end gap-0.5 px-0.5 pb-1 pt-1">
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-0 text-sky-700/80 hover:bg-sky-100"
                        title="توضیح ستون"
                        aria-label={`توضیح ${col.label}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setHeaderHelpKey((k) => (k === col.key ? null : col.key))
                        }}
                      >
                        <HelpCircle className="h-2.5 w-2.5" />
                      </button>
                      {isWide ? (
                        <span
                          className="text-[10px] font-semibold text-slate-700 text-center leading-tight px-0.5"
                          title={col.label}
                        >
                          {col.label}
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-semibold text-slate-700 leading-none"
                          title={col.label}
                          style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            maxHeight: 88,
                            overflow: 'hidden',
                          }}
                        >
                          {col.label}
                        </span>
                      )}
                    </div>
                    {headerHelpKey === col.key ? (
                      <div
                        className="absolute top-full z-40 mt-1 w-52 max-w-[70vw] rounded-md border border-sky-200 bg-white px-2.5 py-2 text-[10px] font-normal leading-relaxed text-slate-800 shadow-lg"
                        style={{ insetInlineEnd: 0 }}
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {col.help}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`تغییر عرض ${col.label}`}
                      className="absolute inset-y-0 left-0 z-[4] w-1.5 cursor-col-resize bg-transparent hover:bg-sky-500/40 active:bg-sky-600/50 border-l border-transparent hover:border-sky-500"
                      onMouseDown={(e) => startResize(col.key, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, index) => {
              const isParent =
                weightRollup.parentIds.has(task.id) || durationRollup.parentIds.has(task.id)
              const isHeader =
                Boolean(task.is_summary) || isParent || wbsDepth(task.wbs_code) === 0
              const isGroupHeader = wbsDepth(task.wbs_code) === 0
              const displayWeight = isParent
                ? (weightRollup.weights[task.id] ??
                  task.physical_weight ??
                  task.schedule_weight)
                : (task.physical_weight ?? task.schedule_weight)
              const displayDuration =
                isParent || Boolean(task.is_summary)
                  ? (durationRollup.durations[task.id] ?? task.duration_days)
                  : task.duration_days
              const help = weightRollup.explanations.get(task.id)?.text ?? null
              const groupKey = rootWbsKey(task.wbs_code)
              const groupColors = groupColorsByRoot.get(groupKey)
              const groupBgClass = isGroupHeader
                ? (groupColors?.header ?? 'bg-slate-200')
                : (groupColors?.child ?? 'bg-white')
              const isGroupFirst =
                index === 0 || rootWbsKey(sorted[index - 1]?.wbs_code) !== groupKey
              const isGroupLast =
                index === sorted.length - 1 ||
                rootWbsKey(sorted[index + 1]?.wbs_code) !== groupKey
              return (
                <ScheduleTaskRow
                  key={task.id}
                  task={task}
                  columns={visibleColumns}
                  predecessorLabel={predecessorLabels[task.id] ?? '—'}
                  statusAsOf={statusAsOf}
                  isCriticalPath={Boolean(task.is_critical)}
                  displayWeight={displayWeight}
                  displayDuration={displayDuration}
                  isWeightParent={weightRollup.parentIds.has(task.id)}
                  isHeader={isHeader}
                  isGroupFirst={isGroupFirst}
                  isGroupLast={isGroupLast}
                  isSelected={selectedTaskIds.has(task.id)}
                  onSelect={(modifiers) => selectTask(index, task.id, modifiers)}
                  groupBgClass={groupBgClass}
                  contractors={contractors}
                  contractorId={
                    contractorAssignments[task.id]
                      ? contractorAssignments[task.id].subcontractor_id
                      : (task.subcontractor_id ?? null)
                  }
                  resolvedContractorId={
                    contractorAssignments[task.id]
                      ? contractorAssignments[task.id].resolved_subcontractor_id
                      : (task.resolved_subcontractor_id ?? null)
                  }
                  contractorSaving={savingContractorIds.has(task.id)}
                  onContractorChange={(contractorId) =>
                    void assignContractor([task.id], contractorId)
                  }
                  weightHelpText={help}
                  weightInvalid={
                    !projectWeightCheck.ok && projectWeightCheck.contributorIds.has(task.id)
                  }
                  helpOpen={helpParentId === task.id}
                  stickyOffsets={offsets}
                  columnWidths={displayWidths}
                  onToggleWeightHelp={
                    weightRollup.parentIds.has(task.id) && help
                      ? () =>
                          setHelpParentId((id) => (id === task.id ? null : task.id))
                      : undefined
                  }
                  onCloseWeightHelp={() => setHelpParentId(null)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
        </>
      )}

      {contractorView === 'schedule' && selectedTaskIds.size > 1 ? (
        <div
          className="sticky bottom-3 z-40 mx-auto mt-2 flex w-fit max-w-[95%] flex-wrap items-center gap-2 rounded-xl border border-sky-300 bg-white px-3 py-2 text-[11px] shadow-xl"
          dir="rtl"
        >
          <Users className="h-4 w-4 text-sky-700" />
          <strong>{selectedTaskIds.size} فعالیت انتخاب شده</strong>
          <select
            value={bulkContractorId}
            onChange={(event) => setBulkContractorId(event.target.value)}
            className="h-8 min-w-44 rounded-md border bg-white px-2"
          >
            <option value="">پاک‌کردن و بازگشت به وراثت</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={savingContractorIds.size > 0}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-sky-700 px-3 font-semibold text-white disabled:opacity-50"
            onClick={() =>
              void assignContractor(
                [...selectedTaskIds],
                bulkContractorId || null
              )
            }
          >
            {savingContractorIds.size > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            تخصیص پیمانکار
          </button>
          <button
            type="button"
            className="h-8 rounded-md border px-2"
            onClick={() => setSelectedTaskIds(new Set())}
          >
            لغو انتخاب
          </button>
        </div>
      ) : null}
    </div>
  )
}
