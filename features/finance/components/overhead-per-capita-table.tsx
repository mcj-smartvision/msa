'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { MonthColumnHeader } from '@/features/finance/components/month-column-header'
import {
commitDisplayedColumns,
loadOverheadMonthTotals,
suggestedNeighborMonth,
} from '@/features/finance/components/overhead-costs-matrix'
import {
deductedMonthFromLabel,
overheadCostForScheduleMonths,
scheduleMonthsFromTree,
} from '@/features/finance/lib/overhead-schedule-months'
import { allocateOverhead } from '@/features/schedule/lib/month-progress-overhead'
import { earnedWeightsFromDailyReports } from '@/features/schedule/lib/earned-month-weight'
import { applyParentWeightSum } from '@/features/schedule/lib/parent-weight-rollup'
import { displayActivityName } from '@/features/schedule/lib/wbs-utils'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import {
dailyReportActivityLookupIds,
type DailyProgressEntry,
} from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode } from '@/features/workshop/lib/types'
import { enrichScheduleTreeWithWbs } from '@/features/workshop/lib/wbs-numbering'
import { cn } from '@/shared/lib/utils'

type ActivityRow = {
  id: string
  wbs: string
  name: string
  depth: number
  isParent: boolean
  earned: Array<number | null>
}

function formatMoney(value: number, fa: boolean, blankZero = false): string {
  if (!Number.isFinite(value) || (blankZero && Math.abs(value) < 0.0001)) return '—'
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 2,
  })
}

function reportsForActivity(activityId: string, entries: DailyProgressEntry[]): DailyProgressEntry[] {
  const keys = new Set(dailyReportActivityLookupIds(activityId))
  return entries.filter((entry) => keys.has(entry.activityId))
}

function flattenTasks(nodes: ScheduleTreeNode[]): ScheduleTreeNode[] {
  const out: ScheduleTreeNode[] = []
  function walk(list: ScheduleTreeNode[]) {
    for (const node of list) {
      if (node.taskId) out.push(node)
      if (node.children.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export function OverheadPerCapitaTable({
  projectId,
  fa,
}: {
  projectId: string | null
  fa: boolean
}) {
  const [nodes, setNodes] = useState<ScheduleTreeNode[]>([])
  const [entries, setEntries] = useState<DailyProgressEntry[]>([])
  const [overhead, setOverhead] = useState<{
    labels: string[]
    totals: number[]
    customized: boolean
  }>({
    labels: [],
    totals: [],
    customized: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setNodes([])
      setEntries([])
      setOverhead({ labels: [], totals: [], customized: false })
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [treeRes, progressRes] = await Promise.all([
          fetch(`/api/workshop/schedule-tree?projectId=${encodeURIComponent(projectId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/supervisor/daily-progress?projectId=${encodeURIComponent(projectId)}`, {
            cache: 'no-store',
          }),
        ])
        const treeJson = await treeRes.json()
        if (!treeRes.ok) throw new Error(treeJson.error || 'خطا در بارگذاری برنامه')
        const progressJson = await progressRes.json().catch(() => ({ updates: [] }))
        if (cancelled) return
        const saved: DailyProgressEntry[] = Array.isArray(progressJson.updates)
          ? progressJson.updates.map((row: Record<string, unknown>) => ({
              activityId: String(row.task_id ?? ''),
              reportDate: String(row.progress_date ?? '').slice(0, 10),
              percentComplete: Number(row.percent_complete) || 0,
            }))
          : []
        const local = readProjectDailyProgress(projectId).entries
        const merged = new Map<string, DailyProgressEntry>()
        for (const entry of saved) {
          if (!entry.reportDate) continue
          merged.set(`${entry.activityId}@${entry.reportDate}`, entry)
        }
        for (const entry of local) {
          const date = entry.reportDate.slice(0, 10)
          if (!date) continue
          merged.set(`${entry.activityId}@${date}`, { ...entry, reportDate: date })
        }
        setNodes(enrichScheduleTreeWithWbs(treeJson.nodes ?? []))
        setEntries([...merged.values()])
        setOverhead(loadOverheadMonthTotals(projectId, fa))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطا')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, fa])

  const model = useMemo(() => {
    const tasks = flattenTasks(nodes)
    const rollup = applyParentWeightSum(
      tasks.map((node) => ({
        id: node.taskId!,
        wbs: node.wbs,
        name: node.name,
        weight: node.scheduleWeight ?? null,
      }))
    )
    const scheduleMonths = scheduleMonthsFromTree(nodes)
    const months = overhead.customized
      ? overhead.labels.map((label, index) =>
          deductedMonthFromLabel(label, index, scheduleMonths[0]?.jy ?? null)
        )
      : scheduleMonths
    const monthCost = overhead.customized
      ? months.map((_, index) => overhead.totals[index] ?? 0)
      : overheadCostForScheduleMonths(overhead.labels, overhead.totals, months)
    const leaves = tasks.filter((node) => node.taskId && !rollup.parentIds.has(node.taskId))

    const earnedById = new Map<string, Array<number | null>>()
    for (const node of leaves) {
      const id = node.taskId!
      const weight =
        node.task?.physical_weight != null && Number.isFinite(Number(node.task.physical_weight))
          ? Number(node.task.physical_weight)
          : node.task?.schedule_weight != null && Number.isFinite(Number(node.task.schedule_weight))
            ? Number(node.task.schedule_weight)
            : node.scheduleWeight != null
              ? Number(node.scheduleWeight)
              : 0
      earnedById.set(
        id,
        earnedWeightsFromDailyReports(weight, reportsForActivity(id, entries), months)
      )
    }

    const shareById = new Map<string, number[]>()
    months.forEach((_, index) => {
      const ids = leaves.map((node) => node.taskId!)
      const parts = ids.map((id) => earnedById.get(id)?.[index] ?? 0)
      const shares = allocateOverhead(monthCost[index] ?? 0, parts)
      ids.forEach((id, leafIndex) => {
        const row = shareById.get(id) ?? months.map(() => 0)
        row[index] = shares[leafIndex] ?? 0
        shareById.set(id, row)
      })
    })

    const rows: ActivityRow[] = tasks.map((node) => {
      const id = node.taskId!
      const isParent = rollup.parentIds.has(id)
      const prefix = node.wbs?.trim() ? `${node.wbs.trim()}.` : null
      const earned = months.map((_, index) => {
        if (!isParent) {
          const weight = earnedById.get(id)?.[index]
          if (weight == null) return null
          return shareById.get(id)?.[index] ?? 0
        }
        const kids = leaves.filter((leaf) => prefix && leaf.wbs?.trim().startsWith(prefix))
        let sum = 0
        let any = false
        for (const kid of kids) {
          const value = kid.taskId ? earnedById.get(kid.taskId)?.[index] : null
          if (value == null) continue
          any = true
          sum += shareById.get(kid.taskId!)?.[index] ?? 0
        }
        return any ? Math.round(sum * 10000) / 10000 : null
      })
      return {
        id,
        wbs: node.wbs?.trim() || '—',
        name: displayActivityName(node.name, node.wbs),
        depth: node.depth,
        isParent,
        earned,
      }
    })

    const performed = months.map((_, index) =>
      Math.round(
        leaves.reduce((sum, node) => sum + (shareById.get(node.taskId!)?.[index] ?? 0), 0) * 10000
      ) / 10000
    )

    return { months, monthCost, rows, performed }
  }, [nodes, entries, overhead])

  function editColumns(
    edit: Parameters<typeof commitDisplayedColumns>[3]
  ) {
    if (!projectId) return
    const displayed = model.months.map((month) => month.label)
    const next = commitDisplayedColumns(projectId, fa, displayed, edit)
    setOverhead({ ...next, customized: true })
  }

  if (!projectId) {
    return (
      <p className="text-sm text-muted-foreground">
        {fa ? 'ابتدا یک پروژه انتخاب کنید.' : 'Select a project first.'}
      </p>
    )
  }
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {fa ? 'در حال محاسبه…' : 'Calculating…'}
      </p>
    )
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>

  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-xs leading-relaxed text-slate-600">
        {fa
          ? 'با + کنار هر ماه، ستون قبل یا بعد اضافه کنید و نام ماه را بنویسید. مبلغ همان ماه را در ردیف مشکی پایین وارد کنید. سهم هر فعالیت = این مبلغ × (وزن کسب‌شده ÷ جمع وزن کسب‌شده).'
          : 'Use + beside a month to insert a column and type its name. Enter that month’s amount in the dark footer. Each activity gets that amount × its earned-weight share.'}
      </p>
      <div className="max-h-[min(75vh,820px)] overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-max border-separate border-spacing-0 text-[11px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-100 text-slate-700">
              <th className="sticky start-0 z-30 whitespace-nowrap border-b border-e border-slate-300 bg-slate-100 px-2 py-2 text-center">
                WBS
              </th>
              <th className="sticky z-30 whitespace-nowrap border-b border-e border-slate-300 bg-slate-100 px-2 py-2 text-start" style={{ insetInlineStart: 52 }}>
                {fa ? 'نام' : 'Name'}
              </th>
              {model.months.map((month, index) => (
                <th
                  key={month.key}
                  className="border-b border-e border-slate-300 bg-slate-100 px-1 py-1 text-center"
                >
                  <MonthColumnHeader
                    label={month.label}
                    fa={fa}
                    canRemove={model.months.length > 1}
                    onChangeLabel={(value) => editColumns({ type: 'rename', index, label: value })}
                    onInsertBefore={() =>
                      editColumns({
                        type: 'insert',
                        index,
                        label: suggestedNeighborMonth(month.label, -1, fa),
                      })
                    }
                    onInsertAfter={() =>
                      editColumns({
                        type: 'insert',
                        index: index + 1,
                        label: suggestedNeighborMonth(month.label, 1, fa),
                      })
                    }
                    onRemove={() => editColumns({ type: 'remove', index })}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.length === 0 ? (
              <tr>
                <td colSpan={2 + model.months.length} className="px-3 py-8 text-center text-slate-500">
                  {fa ? 'فعالیتی در برنامه نیست.' : 'No schedule activities.'}
                </td>
              </tr>
            ) : null}
            {model.rows.map((row) => (
              <tr key={row.id} className={row.isParent ? 'bg-sky-50 font-semibold' : 'bg-white'}>
                <td
                  className={cn(
                    'sticky start-0 z-10 whitespace-nowrap border-b border-e border-slate-200 px-2 py-1 text-center font-mono',
                    row.isParent ? 'bg-sky-50' : 'bg-white'
                  )}
                >
                  {row.wbs}
                </td>
                <td
                  className={cn(
                    'sticky z-10 whitespace-nowrap border-b border-e border-slate-200 px-2 py-1',
                    row.isParent ? 'bg-sky-50' : 'bg-white'
                  )}
                  style={{ insetInlineStart: 52, paddingInlineStart: 8 + row.depth * 12 }}
                >
                  {row.name}
                </td>
                {row.earned.map((value, index) => (
                  <td
                    key={`${row.id}-${model.months[index]?.key ?? index}`}
                    className="whitespace-nowrap border-b border-e border-slate-200 px-2 py-1 text-center tabular-nums"
                  >
                    {value == null ? '—' : formatMoney(value, fa, true)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {model.months.length > 0 ? (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-emerald-50 font-semibold text-emerald-950">
                <td className="sticky start-0 z-30 border-e border-t border-slate-300 bg-emerald-50 px-2 py-2" />
                <td className="sticky z-30 border-e border-t border-slate-300 bg-emerald-50 px-2 py-2" style={{ insetInlineStart: 52 }}>
                  {fa ? 'جمع کار انجام‌شده' : 'Performed total'}
                </td>
                {model.performed.map((value, index) => (
                  <td
                    key={`done-${model.months[index]?.key ?? index}`}
                    className="border-e border-t border-slate-300 px-2 py-2 text-center tabular-nums"
                  >
                    {formatMoney(value, fa)}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-900 font-semibold text-white">
                <td className="sticky start-0 z-30 border-e border-slate-700 bg-slate-900 px-2 py-2" />
                <td className="sticky z-30 border-e border-slate-700 bg-slate-900 px-2 py-2" style={{ insetInlineStart: 52 }}>
                  {fa ? 'هزینهٔ واقعی ثبت‌شده' : 'Recorded overhead'}
                </td>
                {model.monthCost.map((value, index) => (
                  <td
                    key={`real-${model.months[index]?.key ?? index}`}
                    className="border-e border-slate-700 px-1 py-1 text-center"
                  >
                    <input
                      key={`${model.months[index]?.label ?? index}:${value}`}
                      dir="ltr"
                      defaultValue={String(value)}
                      aria-label={fa ? `مبلغ ${model.months[index]?.label ?? ''}` : 'Month amount'}
                      onBlur={(event) => {
                        const next = Number(event.target.value)
                        if (!Number.isFinite(next) || next === value) return
                        editColumns({ type: 'total', index, total: next })
                      }}
                      className="w-full rounded border border-slate-600 bg-slate-800 px-1 py-1 text-center text-[11px] font-semibold text-white outline-none focus:border-orange-300"
                    />
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
