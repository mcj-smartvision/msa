'use client'

import { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { ScheduleTaskRow } from '@/components/schedule/schedule-task-row'
import { applyParentWeightSum } from '@/lib/schedule/parent-weight-rollup'
import { compareWbs, wbsDepth } from '@/lib/schedule/wbs-utils'
import { todayIso } from '@/lib/schedule/task-view-date'
import type { ProjectTask } from '@/types/schedule'
import { cn } from '@/lib/utils'

interface SchedulePreviewTableProps {
  tasks: ProjectTask[]
  predecessorLabels?: Record<string, string>
  /** Status as-of date (defaults to today). */
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

  /** Same hierarchy order as ویرایش برنامه (WBS), not date order. */
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code)),
    [tasks]
  )

  const weightRollup = useMemo(() => {
    const nodes = sorted.map((t) => ({
      id: t.id,
      wbs: t.wbs_code?.trim() || null,
      name: t.name,
      weight:
        t.schedule_weight != null && Number.isFinite(Number(t.schedule_weight))
          ? Number(t.schedule_weight)
          : null,
    }))
    return applyParentWeightSum(nodes)
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

  if (sorted.length === 0) return null

  return (
    <div className={cn('space-y-0', className)}>
      {!projectWeightCheck.ok ? (
        <div
          className="flex items-start gap-2 border-b border-red-300 bg-red-50 px-4 py-2.5 text-[12px] leading-snug text-red-800"
          role="alert"
          dir="rtl"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            خطای وزن‌دهی: جمع وزن سرتیترها و فعالیت‌های بدون‌فرزند سطح پروژه{' '}
            <strong className="tabular-nums">{projectWeightCheck.sum}</strong> است؛ باید{' '}
            <strong>۱۰۰</strong> باشد
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
            . کادرهای قرمز همان مقادیری هستند که در این جمع شرکت دارند. برای اصلاح به ویرایش برنامه
            بروید.
          </span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1080px]">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[88px]">WBS</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[320px]">
                فعالیت
              </th>
              <th className="text-center px-2 py-3 font-medium text-muted-foreground w-[72px]">
                بحرانی
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[112px]">
                شروع
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[112px]">
                پایان
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[120px]">
                وضعیت
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[140px]">
                پیش‌نیازها
              </th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground w-[96px]">وزن</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground w-[52px]">%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => {
              const isParent = weightRollup.parentIds.has(task.id)
              const displayWeight = isParent
                ? (weightRollup.weights[task.id] ?? task.schedule_weight)
                : task.schedule_weight
              const help = weightRollup.explanations.get(task.id)?.text ?? null
              return (
                <ScheduleTaskRow
                  key={task.id}
                  task={task}
                  predecessorLabel={predecessorLabels[task.id] ?? '—'}
                  statusAsOf={statusAsOf}
                  isCriticalPath={Boolean(task.is_critical)}
                  displayWeight={displayWeight}
                  isWeightParent={isParent}
                  weightHelpText={help}
                  weightInvalid={
                    !projectWeightCheck.ok && projectWeightCheck.contributorIds.has(task.id)
                  }
                  helpOpen={helpParentId === task.id}
                  onToggleWeightHelp={
                    isParent && help
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
    </div>
  )
}
