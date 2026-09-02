'use client'

import { useMemo } from 'react'
import { ScheduleTaskRow } from '@/components/schedule/schedule-task-row'
import { todayIso } from '@/lib/schedule/task-view-date'
import { compareWbs } from '@/lib/schedule/wbs-utils'
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
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => compareWbs(a.wbs_code, b.wbs_code)),
    [tasks]
  )

  if (sorted.length === 0) return null

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm min-w-[1080px]">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[88px]">WBS</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[320px]">فعالیت</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-[72px]">بحرانی</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[112px]">شروع</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[112px]">پایان</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-[120px]">وضعیت</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[140px]">پیش‌نیازها</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground w-[64px]">وزن</th>
            <th className="text-right px-3 py-3 font-medium text-muted-foreground w-[52px]">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => (
            <ScheduleTaskRow
              key={task.id}
              task={task}
              predecessorLabel={predecessorLabels[task.id] ?? '—'}
              statusAsOf={statusAsOf}
              isCriticalPath={Boolean(task.is_critical)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
