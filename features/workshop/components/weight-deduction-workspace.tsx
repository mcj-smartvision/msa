'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/features/admin/components/shared'
import { applyParentWeightSum } from '@/features/schedule/lib/parent-weight-rollup'
import { applyWeightedParentRollup } from '@/features/schedule/lib/parent-progress-rollup'
import {
enumerateProjectJalaliMonths,
formatDeductedWeight,
projectDateSpan,
type DeductedWeightMonth,
} from '@/features/schedule/lib/monthly-deducted-weight'
import { plannedMonthlyWeights, plannedWeightsOnMonths } from '@/features/schedule/lib/planned-month-weight'
import { earnedWeightsFromPhysicalProgress } from '@/features/schedule/lib/earned-month-weight'
import { toIsoDateOnly } from '@/features/schedule/lib/dates'
import { displayActivityName } from '@/features/schedule/lib/wbs-utils'
import { useScheduleViewSync } from '@/features/schedule/lib/schedule-view-sync'
import { formatScheduleWeightDisplay } from '@/features/workshop/lib/package-weight'
import type { ScheduleTreeNode } from '@/features/workshop/lib/types'
import { enrichScheduleTreeWithWbs } from '@/features/workshop/lib/wbs-numbering'
import {
mergeSupervisorProgressEntries,
resolvePhysicalProgressPercent,
schedulePhysicalPercent,
} from '@/features/schedule/lib/physical-progress'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import { type DailyProgressEntry } from '@/features/supervisor/lib/daily-report-activities'
import { cn } from '@/shared/lib/utils'
import { todayTehranIso } from '@/shared/lib/time/tehran'

function shownNumber(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function earnedTone(earned: number | null | undefined, planned: number): string {
  if (earned == null) return 'text-slate-300'
  if (!(planned > 0)) return 'text-slate-700'
  return earned >= planned - 0.0001 ? 'text-emerald-700' : 'text-rose-600'
}

function plannedOriginText(
  row: RowMeta,
  month: DeductedWeightMonth,
  months: DeductedWeightMonth[],
  shown: number,
  childParts: Array<{ name: string; value: number }>
): string {
  if (row.isParent) {
    const parts = childParts.filter((part) => part.value !== 0)
    if (parts.length === 0) {
      return `Planned ${month.label} جمع Planned زیرشاخه‌هاست و برابر ${shownNumber(shown)} است.`
    }
    const expr = parts.map((part) => `${part.name} ${shownNumber(part.value)}`).join(' + ')
    return `جمع Planned زیرشاخه‌ها در ${month.label}: ${expr} = ${shownNumber(shown)}`
  }
  const weight = row.physicalWeight ?? row.weight ?? 0
  const slices = plannedMonthlyWeights(
    weight,
    row.startDate || row.baselineStart,
    row.finishDate || row.baselineFinish,
    months
  )
  const totalDays = slices.reduce((sum, slice) => sum + slice.overlapDays, 0)
  const slice = slices.find((item) => item.snapshotMonth === month.startIso)
  if (!slice || totalDays <= 0) {
    return `Planned ${month.label} از تاریخ شروع و پایان همین فعالیت در ویرایش برنامه آمده و برابر ${shownNumber(shown)} است.`
  }
  return `از ویرایش برنامه زمانبندی. وزن ${shownNumber(weight)} روی مدت فعالیت (${totalDays} روز، از شروع تا پایان) پخش شده. ${month.label} ${slice.overlapDays} روز از این مدت است: ${slice.overlapDays}÷${totalDays}×${shownNumber(weight)} = ${shownNumber(shown)}`
}

function earnedOriginText(
  row: RowMeta,
  month: DeductedWeightMonth,
  monthIndex: number,
  plannedByMonth: number[],
  earned: number,
  childParts: Array<{ name: string; value: number }>,
  currentMonthIndex: number
): string {
  if (row.isParent) {
    const parts = childParts.filter((part) => part.value !== 0)
    if (parts.length === 0) {
      return `Earned ${month.label} جمع Earned زیرشاخه‌هاست و برابر ${shownNumber(earned)} است.`
    }
    const expr = parts.map((part) => `${part.name} ${shownNumber(part.value)}`).join(' + ')
    return `جمع Earned زیرشاخه‌ها در ${month.label}: ${expr} = ${shownNumber(earned)}`
  }
  const weight = row.weight ?? 0
  const percent = row.physicalPercent
  if (percent == null) return 'برای این فعالیت پیشرفت فیزیکی ثبت نشده.'
  const product = Math.round(((weight * percent) / 100) * 100) / 100
  const plannedHere = plannedByMonth[monthIndex] ?? 0
  const plannedUpToNow = plannedByMonth.slice(0, currentMonthIndex + 1)
  const plannedSum = plannedUpToNow.reduce((sum, value) => sum + (value || 0), 0)
  const monthCount = plannedUpToNow.filter((value) => value > 0).length
  if (monthCount <= 1) {
    return `وزن ${shownNumber(weight)} × پیشرفت فیزیکی ${shownNumber(percent)}٪ = ${shownNumber(earned)}`
  }
  return `وزن ${shownNumber(weight)} × پیشرفت فیزیکی ${shownNumber(percent)}٪ = ${shownNumber(product)}. این حاصل به نسبت Planned ماه‌های ${row.name} تا ماه جاری پخش شده. Planned ${month.label} برابر ${shownNumber(plannedHere)} از ${shownNumber(plannedSum)} است، پس Earned این ماه = ${shownNumber(earned)}`
}

function expandAllSchedule(nodes: ScheduleTreeNode[]): Record<string, boolean> {
  const exp: Record<string, boolean> = {}
  function walk(list: ScheduleTreeNode[]) {
    for (const n of list) {
      exp[n.id] = true
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return exp
}

type RowMeta = {
  id: string
  nodeId: string
  wbs: string
  name: string
  depth: number
  startDate: string | null
  finishDate: string | null
  baselineStart: string | null
  baselineFinish: string | null
  physicalWeight: number | null
  weight: number | null
  physicalPercent: number | null
  isParent: boolean
  hasChildren: boolean
}

export function WeightDeductionWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const tabActive = (searchParams.get('workshopTab') ?? 'schedule') === 'weight-deduction'

  const [nodes, setNodes] = useState<ScheduleTreeNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dailyProgressEntries, setDailyProgressEntries] = useState<DailyProgressEntry[]>([])
  const [savedProgressEntries, setSavedProgressEntries] = useState<DailyProgressEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [progressSnapshots, setProgressSnapshots] = useState<
    Array<{ activityId: string; snapshotMonth: string; jalaliMonth: string; cumulativePercent: number }>
  >([])
  const wbsHeadRef = useRef<HTMLTableCellElement>(null)
  const [nameStickyStart, setNameStickyStart] = useState(40)
  const [originHelp, setOriginHelp] = useState<{
    key: string
    text: string
    top: number
    right: number
  } | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/workshop/schedule-tree?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در بارگذاری برنامه')
      const tree = enrichScheduleTreeWithWbs(data.nodes ?? [])
      setNodes(tree)
      setExpanded(expandAllSchedule(tree))
      setDailyProgressEntries(readProjectDailyProgress(projectId).entries)
      try {
        const progressRes = await fetch(
          `/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const progressData = await progressRes.json()
        if (progressRes.ok) {
          const updates = Array.isArray(progressData.updates) ? progressData.updates : []
          setSavedProgressEntries(
            updates.map((row: Record<string, unknown>) => ({
              activityId: String(row.task_id ?? ''),
              reportDate: String(row.progress_date ?? '').slice(0, 10),
              percentComplete: Number(row.percent_complete) || 0,
            }))
          )
        }
      } catch {
        /* local daily-report entries still apply */
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener('workshop-refresh', onRefresh)
    return () => window.removeEventListener('workshop-refresh', onRefresh)
  }, [load])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void (async () => {
      await fetch('/api/schedule/progress-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, force: true }),
      }).catch(() => {
        /* history starts once migration 93 is applied */
      })
      await fetch('/api/schedule/planned-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      }).catch(() => {
        /* planned weights persist once migration 94 is applied */
      })
      if (cancelled) return
      try {
        const res = await fetch(
          `/api/schedule/progress-snapshots?projectId=${encodeURIComponent(projectId)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (!res.ok || cancelled) return
        const rows = Array.isArray(data.snapshots) ? data.snapshots : []
        setProgressSnapshots(
          rows.map((row: Record<string, unknown>) => ({
            activityId: String(row.activity_id ?? ''),
            snapshotMonth: String(row.snapshot_month ?? '').slice(0, 10),
            jalaliMonth: String(row.jalali_month ?? ''),
            cumulativePercent: Number(row.cumulative_percent) || 0,
          }))
        )
      } catch {
        /* no earned history yet */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) {
      setDailyProgressEntries([])
      return
    }
    const refreshDaily = () => setDailyProgressEntries(readProjectDailyProgress(projectId).entries)
    refreshDaily()
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail
      if (detail?.projectId && detail.projectId !== projectId) return
      refreshDaily()
      void load()
    }
    window.addEventListener('sitepilot-daily-progress-updated', onUpdated)
    window.addEventListener('storage', refreshDaily)
    return () => {
      window.removeEventListener('sitepilot-daily-progress-updated', onUpdated)
      window.removeEventListener('storage', refreshDaily)
    }
  }, [projectId, load])

  useScheduleViewSync(projectId, () => void load(), { active: tabActive })

  const scheduleTaskFlat = useMemo(() => {
    const out: ScheduleTreeNode[] = []
    function walk(list: ScheduleTreeNode[]) {
      for (const n of list) {
        if (n.taskId) out.push(n)
        if (n.children.length) walk(n.children)
      }
    }
    walk(nodes)
    return out
  }, [nodes])

  const weightRollup = useMemo(
    () =>
      applyParentWeightSum(
        scheduleTaskFlat.map((n) => ({
          id: n.taskId!,
          wbs: n.wbs,
          name: n.name,
          weight: n.scheduleWeight ?? null,
        }))
      ),
    [scheduleTaskFlat]
  )

  const progressEntries = useMemo(
    () => mergeSupervisorProgressEntries(savedProgressEntries, dailyProgressEntries),
    [savedProgressEntries, dailyProgressEntries]
  )

  const progressRollup = useMemo(
    () =>
      applyWeightedParentRollup(
        scheduleTaskFlat.map((n) => {
          const id = n.taskId!
          const isWeightParent = weightRollup.parentIds.has(id)
          const rolledW = weightRollup.weights[id]
          const weight = isWeightParent
            ? rolledW != null && Number.isFinite(Number(rolledW))
              ? Number(rolledW)
              : null
            : n.scheduleWeight != null && Number.isFinite(Number(n.scheduleWeight))
              ? Number(n.scheduleWeight)
              : null
          const percent =
            resolvePhysicalProgressPercent(id, schedulePhysicalPercent(n.task), progressEntries) ??
            0
          return { id, wbs: n.wbs, name: n.name, weight, percent }
        })
      ),
    [scheduleTaskFlat, weightRollup, progressEntries]
  )

  const allRowsMeta: RowMeta[] = useMemo(() => {
    return scheduleTaskFlat.map((n) => {
      const id = n.taskId!
      const isParent = weightRollup.parentIds.has(id)
      const rolledW = weightRollup.weights[id]
      const weight = isParent
        ? rolledW != null && Number.isFinite(Number(rolledW))
          ? Number(rolledW)
          : null
        : n.scheduleWeight != null && Number.isFinite(Number(n.scheduleWeight))
          ? Number(n.scheduleWeight)
          : null
      const leafProgress = resolvePhysicalProgressPercent(
        id,
        schedulePhysicalPercent(n.task),
        progressEntries
      )
      return {
        id,
        nodeId: n.id,
        wbs: n.wbs?.trim() || '—',
        name: displayActivityName(n.name),
        depth: n.depth,
        startDate: n.startDate,
        finishDate: n.finishDate,
        baselineStart: toIsoDateOnly(n.task?.baseline_start),
        baselineFinish: toIsoDateOnly(n.task?.baseline_finish),
        physicalWeight:
          n.task?.physical_weight != null && Number.isFinite(Number(n.task.physical_weight))
            ? Number(n.task.physical_weight)
            : n.task?.schedule_weight != null && Number.isFinite(Number(n.task.schedule_weight))
              ? Number(n.task.schedule_weight)
              : weight,
        weight,
        physicalPercent: isParent ? progressRollup.percents[id] ?? leafProgress : leafProgress,
        isParent,
        hasChildren: n.children.some((c) => Boolean(c.taskId)),
      }
    })
  }, [scheduleTaskFlat, weightRollup, progressRollup, progressEntries])

  const months = useMemo(() => {
    const points = [
      ...allRowsMeta.map((row) => ({
        startDate: row.startDate || row.baselineStart,
        finishDate: row.finishDate || row.baselineFinish,
      })),
      ...progressSnapshots.map((snapshot) => ({
        startDate: snapshot.snapshotMonth,
        finishDate: snapshot.snapshotMonth,
      })),
      ...progressEntries.map((entry) => ({
        startDate: entry.reportDate,
        finishDate: entry.reportDate,
      })),
    ]
    const span = projectDateSpan(points)
    return enumerateProjectJalaliMonths(span.start, span.finish)
  }, [allRowsMeta, progressSnapshots, progressEntries])

  const currentMonthIndex = useMemo(() => {
    const today = todayTehranIso()
    if (months.length === 0 || today < months[0]!.startIso) return -1
    const index = months.findIndex((month) => today >= month.startIso && today <= month.endIso)
    return index >= 0 ? index : months.length - 1
  }, [months])

  const monthlyById = useMemo(() => {
    const map = new Map<string, number[]>()
    const leaves = allRowsMeta.filter((row) => !weightRollup.parentIds.has(row.id))
    for (const row of allRowsMeta) {
      map.set(
        row.id,
        plannedWeightsOnMonths(
          row.physicalWeight,
          row.startDate || row.baselineStart,
          row.finishDate || row.baselineFinish,
          months
        )
      )
    }
    for (const row of allRowsMeta) {
      if (!weightRollup.parentIds.has(row.id)) continue
      const prefix = row.wbs && row.wbs !== '—' ? `${row.wbs}.` : null
      const kids = prefix ? leaves.filter((leaf) => leaf.wbs.startsWith(prefix)) : []
      if (kids.length === 0) continue
      map.set(
        row.id,
        months.map((_, index) => {
          let sum = 0
          for (const kid of kids) sum += map.get(kid.id)?.[index] ?? 0
          return Math.round(sum * 10000) / 10000
        })
      )
    }
    return map
  }, [allRowsMeta, months, weightRollup])

  const earnedById = useMemo(() => {
    const map = new Map<string, Array<number | null>>()
    const leaves = allRowsMeta.filter((row) => !weightRollup.parentIds.has(row.id))
    for (const row of leaves) {
      const earned =
        currentMonthIndex < 0
          ? months.map(() => null)
          : earnedWeightsFromPhysicalProgress(
              row.weight,
              row.physicalPercent,
              monthlyById.get(row.id) ?? [],
              currentMonthIndex
            )
      map.set(row.id, earned)
    }
    for (const row of allRowsMeta) {
      if (!weightRollup.parentIds.has(row.id)) continue
      const prefix = row.wbs && row.wbs !== '—' ? `${row.wbs}.` : null
      const kids = prefix ? leaves.filter((leaf) => leaf.wbs.startsWith(prefix)) : []
      map.set(
        row.id,
        months.map((_, index) => {
          let sum = 0
          let any = false
          for (const kid of kids) {
            const value = map.get(kid.id)?.[index]
            if (value == null) continue
            any = true
            sum += value
          }
          return any ? Math.round(sum * 10000) / 10000 : null
        })
      )
    }
    return map
  }, [allRowsMeta, months, monthlyById, weightRollup, currentMonthIndex])

  const visibleRows = useMemo(() => {
    const rows: Array<RowMeta & { monthly: number[]; earned: Array<number | null> }> = []
    function walk(list: ScheduleTreeNode[]) {
      for (const n of list) {
        if (!n.taskId) {
          if (n.children.length && expanded[n.id] !== false) walk(n.children)
          continue
        }
        const meta = allRowsMeta.find((r) => r.id === n.taskId)
        if (!meta) continue
        rows.push({
          ...meta,
          monthly: monthlyById.get(meta.id) ?? months.map(() => 0),
          earned: earnedById.get(meta.id) ?? months.map(() => null),
        })
        if (expanded[n.id] !== false && n.children.length) walk(n.children)
      }
    }
    walk(nodes)
    return rows
  }, [nodes, expanded, allRowsMeta, monthlyById, earnedById, months])

  const earnedMonthTotals = useMemo(() => {
    const leaves = allRowsMeta.filter((row) => !weightRollup.parentIds.has(row.id))
    return months.map((_, mi) => {
      let sum = 0
      let any = false
      for (const row of leaves) {
        const value = earnedById.get(row.id)?.[mi]
        if (value == null) continue
        any = true
        sum += value
      }
      return any ? Math.round(sum * 10000) / 10000 : null
    })
  }, [allRowsMeta, months, earnedById, weightRollup])

  const monthTotals = useMemo(() => {
    const leaves = allRowsMeta.filter((row) => !weightRollup.parentIds.has(row.id))
    return months.map((_, mi) => {
      let sum = 0
      for (const row of leaves) sum += monthlyById.get(row.id)?.[mi] ?? 0
      return Math.round(sum * 10000) / 10000
    })
  }, [allRowsMeta, months, monthlyById, weightRollup])

  useEffect(() => {
    const el = wbsHeadRef.current
    if (!el) return
    const apply = () => setNameStickyStart(Math.ceil(el.getBoundingClientRect().width))
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visibleRows.length, loading])

  const rootWeightSum = useMemo(
    () => allRowsMeta.filter((r) => r.depth === 0).reduce((s, r) => s + (r.weight ?? 0), 0),
    [allRowsMeta]
  )

  function openOrigin(event: MouseEvent<HTMLButtonElement>, key: string, text: string) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const next = {
      key,
      text,
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    }
    setOriginHelp((current) => (current?.key === key ? null : next))
  }

  if (!projectId) {
    return <p className="text-sm text-slate-600">پروژه را از بالا انتخاب کنید.</p>
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4" dir="rtl">
      {showBanner ? (
        <PageHeader
          title="وزن کسر شده ماهانه"
          description="درصد پیشرفت فیزیکی همان عدد ویرایش برنامه است. Earned هر فعالیت برابر وزن ضربدر همان درصد پیشرفت فیزیکی است."
        />
      ) : (
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">وزن کسر شده ماهانه</h2>
          <p className="text-xs leading-relaxed text-slate-600">
            درصد پیشرفت فیزیکی همان عدد ویرایش برنامه است. Earned هر فعالیت برابر وزن ضربدر همان درصد است و به نسبت Planned روی ماه‌های همان فعالیت تا ماه جاری پخش می‌شود؛ ماه‌های آینده «—» نشان داده می‌شوند.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          بروزرسانی
        </button>
        {message ? <span className="text-xs text-red-600">{message}</span> : null}
        {months.length > 0 ? (
          <span className="text-[11px] text-slate-500">
            {months.length} ماه · از {months[0]?.label} تا {months[months.length - 1]?.label}
          </span>
        ) : null}
      </div>

      <div
        className="max-h-[min(75vh,820px)] overflow-auto rounded-lg border border-slate-200 bg-white"
        onScroll={() => setOriginHelp(null)}
      >
        <table className="w-max border-separate border-spacing-0 text-[11px]">
          <thead className="sticky top-0 z-30">
            <tr className="bg-slate-100 text-slate-700">
              <th
                ref={wbsHeadRef}
                rowSpan={2}
                className="sticky start-0 z-40 w-px whitespace-nowrap border-b border-e border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center align-middle text-[10px] font-semibold"
              >
                WBS
              </th>
              <th
                rowSpan={2}
                className="sticky z-40 w-px whitespace-nowrap border-b border-e border-slate-400 bg-slate-100 px-1.5 py-1.5 text-start align-middle text-[10px] font-semibold shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]"
                style={{ insetInlineStart: nameStickyStart }}
              >
                نام
              </th>
              <th
                rowSpan={2}
                className="w-px whitespace-nowrap border-b border-e border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center align-middle text-[10px] font-semibold"
              >
                وزن
              </th>
              <th
                rowSpan={2}
                className="w-px whitespace-nowrap border-b border-e border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center align-middle text-[10px] font-semibold"
              >
                ٪ پیشرفت فیزیکی
              </th>
              {months.map((m) => (
                <th
                  key={m.key}
                  colSpan={2}
                  className="whitespace-nowrap border-b border-e border-slate-400 bg-slate-100 px-1 py-1 text-center text-[10px] font-semibold"
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr className="bg-slate-100 text-slate-600">
              {months.flatMap((m) => [
                <th
                  key={`${m.key}-planned`}
                  className="w-px whitespace-nowrap border-b border-e border-slate-300 bg-slate-50 px-1 py-1 text-center text-[9px] font-semibold"
                >
                  Planned
                </th>,
                <th
                  key={`${m.key}-earned`}
                  className="w-px whitespace-nowrap border-b border-e border-slate-400 bg-slate-50 px-1 py-1 text-center text-[9px] font-semibold"
                >
                  Earned
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {loading && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={4 + months.length * 2} className="px-3 py-10 text-center text-slate-500">
                  در حال بارگذاری…
                </td>
              </tr>
            ) : null}
            {!loading && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={4 + months.length * 2} className="px-3 py-10 text-center text-slate-500">
                  برنامه‌ای برای این پروژه یافت نشد.
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row) => {
              const open = expanded[row.nodeId] !== false
              const selected = selectedId === row.id
              const cellBg = selected
                ? 'bg-amber-200'
                : row.isParent
                  ? 'bg-sky-50'
                  : 'bg-white'
              const grid = 'border-b border-e border-slate-300'
              return (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="cursor-pointer"
                >
                  <td
                    className={cn(
                      'sticky start-0 z-10 w-px whitespace-nowrap px-1.5 py-1 text-center font-mono text-[10px] tabular-nums text-slate-600',
                      grid,
                      cellBg
                    )}
                  >
                    {row.wbs}
                  </td>
                  <td
                    className={cn(
                      'sticky z-10 w-px whitespace-nowrap px-1.5 py-1 text-start shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.08)]',
                      grid,
                      cellBg
                    )}
                    style={{ insetInlineStart: nameStickyStart }}
                  >
                    <div
                      className="flex items-center gap-0.5"
                      style={{ paddingInlineStart: row.depth * 10 }}
                    >
                      {row.hasChildren ? (
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 hover:bg-slate-200"
                          onClick={(event) => {
                            event.stopPropagation()
                            setExpanded((x) => ({ ...x, [row.nodeId]: !open }))
                          }}
                        >
                          {open ? (
                            <ChevronDown className="h-3 w-3 text-slate-500" />
                          ) : (
                            <ChevronLeft className="h-3 w-3 text-slate-500" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-block w-4 shrink-0" />
                      )}
                      <span
                        className={cn(
                          'whitespace-nowrap',
                          row.isParent ? 'font-semibold text-slate-900' : 'text-slate-800'
                        )}
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      'w-px whitespace-nowrap px-1.5 py-1 text-center tabular-nums',
                      grid,
                      cellBg,
                      row.isParent ? 'font-semibold text-sky-950' : 'text-slate-700'
                    )}
                  >
                    {formatScheduleWeightDisplay(row.weight)}
                  </td>
                  <td
                    className={cn(
                      'w-px whitespace-nowrap px-1.5 py-1 text-center tabular-nums',
                      grid,
                      cellBg,
                      row.isParent ? 'font-semibold text-sky-950' : 'text-slate-700'
                    )}
                    title="از گزارش روزانه سرپرست کارگاه"
                  >
                    {row.physicalPercent == null ? '—' : `${row.physicalPercent}`}
                  </td>
                  {row.monthly.flatMap((planned, i) => {
                    const earned = row.earned[i]
                    const month = months[i]
                    const monthKey = month?.key ?? i
                    const plannedText = formatDeductedWeight(planned)
                    const earnedText = earned == null ? '—' : String(Math.round(earned * 100) / 100)
                    const childLeaves = row.isParent
                      ? allRowsMeta.filter(
                          (item) =>
                            !item.isParent &&
                            row.wbs !== '—' &&
                            item.wbs.startsWith(`${row.wbs}.`)
                        )
                      : []
                    const earnedChildren = childLeaves.flatMap((item) => {
                      const value = earnedById.get(item.id)?.[i]
                      return value == null ? [] : [{ name: item.name, value }]
                    })
                    const plannedChildren = childLeaves.map((item) => ({
                      name: item.name,
                      value: monthlyById.get(item.id)?.[i] ?? 0,
                    }))
                    return [
                      <td
                        key={`${row.id}-${monthKey}-planned`}
                        className={cn(
                          'w-px whitespace-nowrap border-b border-e border-slate-300 px-1 py-1 text-center text-[10px] tabular-nums',
                          cellBg,
                          planned > 0 ? 'text-slate-800' : 'text-slate-300'
                        )}
                      >
                        <span className="inline-flex items-center justify-center gap-0.5">
                          <span>{plannedText}</span>
                          {planned > 0 && month ? (
                            <button
                              type="button"
                              className="text-[11px] font-bold leading-none text-sky-700 hover:text-sky-900"
                              aria-label="Planned از کجا آمده؟"
                              onClick={(event) =>
                                openOrigin(
                                  event,
                                  `${row.id}-planned-${monthKey}`,
                                  plannedOriginText(row, month, months, planned, plannedChildren)
                                )
                              }
                            >
                              ؟
                            </button>
                          ) : null}
                        </span>
                      </td>,
                      <td
                        key={`${row.id}-${monthKey}-earned`}
                        className={cn(
                          'w-px whitespace-nowrap border-b border-e border-slate-400 px-1 py-1 text-center text-[10px] tabular-nums',
                          cellBg,
                          earnedTone(earned, planned)
                        )}
                      >
                        <span className="inline-flex items-center justify-center gap-0.5">
                          <span>{earnedText}</span>
                          {earned != null && month ? (
                            <button
                              type="button"
                              className="text-[11px] font-bold leading-none text-emerald-700 hover:text-emerald-900"
                              aria-label="Earned از کجا آمده؟"
                              onClick={(event) =>
                                openOrigin(
                                  event,
                                  `${row.id}-earned-${monthKey}`,
                                  earnedOriginText(
                                    row,
                                    month,
                                    i,
                                    monthlyById.get(row.id) ?? [],
                                    earned,
                                    earnedChildren,
                                    currentMonthIndex
                                  )
                                )
                              }
                            >
                              ؟
                            </button>
                          ) : null}
                        </span>
                      </td>,
                    ]
                  })}
                </tr>
              )
            })}
          </tbody>
          {months.length > 0 && allRowsMeta.length > 0 ? (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-slate-100 font-semibold text-slate-800">
                <td className="sticky start-0 z-30 w-px whitespace-nowrap border-e border-t border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center">
                  —
                </td>
                <td
                  className="sticky z-30 w-px whitespace-nowrap border-e border-t border-slate-400 bg-slate-100 px-1.5 py-1.5 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]"
                  style={{ insetInlineStart: nameStickyStart }}
                >
                  جمع
                </td>
                <td className="w-px whitespace-nowrap border-e border-t border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center tabular-nums">
                  {formatScheduleWeightDisplay(rootWeightSum)}
                </td>
                <td className="w-px whitespace-nowrap border-e border-t border-slate-400 bg-slate-100 px-1.5 py-1.5 text-center">—</td>
                {monthTotals.flatMap((planned, i) => {
                  const earned = earnedMonthTotals[i]
                  const month = months[i]
                  const monthKey = month?.key ?? i
                  const plannedText = formatDeductedWeight(planned)
                  const earnedText = earned == null ? '—' : String(Math.round(earned * 100) / 100)
                  return [
                    <td
                      key={`total-${monthKey}-planned`}
                      className="w-px whitespace-nowrap border-e border-t border-slate-300 bg-slate-100 px-1 py-1.5 text-center text-[10px] tabular-nums"
                    >
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <span>{plannedText}</span>
                        {planned > 0 && month ? (
                          <button
                            type="button"
                            className="text-[11px] font-bold leading-none text-sky-700 hover:text-sky-900"
                            aria-label="جمع Planned از کجا آمده؟"
                            onClick={(event) =>
                              openOrigin(
                                event,
                                `total-planned-${monthKey}`,
                                `جمع Planned فعالیت‌هایی که خودشان زیرشاخه نیستند، در ${month.label} = ${shownNumber(planned)}`
                              )
                            }
                          >
                            ؟
                          </button>
                        ) : null}
                      </span>
                    </td>,
                    <td
                      key={`total-${monthKey}-earned`}
                      className={cn(
                        'w-px whitespace-nowrap border-e border-t border-slate-400 bg-slate-100 px-1 py-1.5 text-center text-[10px] tabular-nums',
                        earnedTone(earned, planned)
                      )}
                    >
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <span>{earnedText}</span>
                        {earned != null && month ? (
                          <button
                            type="button"
                            className="text-[11px] font-bold leading-none text-emerald-700 hover:text-emerald-900"
                            aria-label="جمع Earned از کجا آمده؟"
                            onClick={(event) =>
                              openOrigin(
                                event,
                                `total-earned-${monthKey}`,
                                `جمع Earned فعالیت‌هایی که خودشان زیرشاخه نیستند، در ${month.label} = ${shownNumber(earned)}`
                              )
                            }
                          >
                            ؟
                          </button>
                        ) : null}
                      </span>
                    </td>,
                  ]
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {originHelp ? (
        <div
          className="fixed z-[80] w-72 rounded-md border border-sky-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-800 shadow-lg"
          style={{ top: originHelp.top, right: originHelp.right }}
          dir="rtl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold text-sky-800">از کجا آمده؟</span>
            <button
              type="button"
              className="text-sky-700 hover:underline"
              onClick={() => setOriginHelp(null)}
            >
              ×
            </button>
          </div>
          <p>{originHelp.text}</p>
        </div>
      ) : null}
    </div>
  )
}
