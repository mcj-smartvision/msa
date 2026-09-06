'use client'

import { memo } from 'react'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { CriticalBadge, TaskStatusBadge } from '@/components/schedule/task-status-badge'
import { getTaskScheduleStatus } from '@/lib/schedule/task-view-date'
import { wbsDepth } from '@/lib/schedule/wbs-utils'
import type { ProjectTask } from '@/types/schedule'
import { cn } from '@/lib/utils'

function formatScheduleWeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

const INDENT_PX = 18

export interface ScheduleTaskRowProps {
  task: ProjectTask
  predecessorLabel: string
  statusAsOf: string
  isCriticalPath?: boolean
}

function ScheduleTaskRowComponent({
  task,
  predecessorLabel,
  statusAsOf,
  isCriticalPath = false,
}: ScheduleTaskRowProps) {
  const depth = wbsDepth(task.wbs_code)
  const indent = depth * INDENT_PX
  const status = getTaskScheduleStatus(task, statusAsOf)
  const start = task.start_planned ?? task.start_current
  const finish = task.finish_planned ?? task.finish_current
  const isOverdue = status === 'overdue'

  return (
    <tr
      className={cn(
        'border-b last:border-0 hover:bg-muted/20',
        isOverdue && 'bg-orange-100/95 border-s-4 border-s-orange-500 hover:bg-orange-100',
        !isOverdue && isCriticalPath && 'bg-red-50/40 hover:bg-red-50/60'
      )}
    >
      <td
        className="px-3 py-2.5 font-mono text-xs text-muted-foreground align-top whitespace-nowrap"
        style={{ paddingInlineStart: `${12 + indent}px` }}
      >
        {task.wbs_code ?? '—'}
      </td>

      <td className="px-3 py-2.5 align-top min-w-[280px]" style={{ paddingInlineStart: `${8 + indent}px` }}>
        <span
          className={cn(
            'leading-relaxed break-words',
            task.is_summary ? 'font-semibold text-foreground' : 'font-medium'
          )}
        >
          {task.name}
        </span>
      </td>

      <td className="px-2 py-2.5 align-top text-center w-[72px]">
        {task.is_critical ? <CriticalBadge compact /> : <span className="text-muted-foreground/40">—</span>}
      </td>

      <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">
        <FormattedDate value={start} />
      </td>

      <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">
        <FormattedDate value={finish} />
      </td>

      <td className="px-3 py-2.5 align-top">
        <TaskStatusBadge status={status} />
      </td>

      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-muted-foreground leading-relaxed break-words">
        {predecessorLabel}
      </td>

      <td className="px-3 py-2.5 align-top tabular-nums text-right text-muted-foreground">
        {formatScheduleWeight(task.schedule_weight)}
      </td>

      <td className="px-3 py-2.5 align-top tabular-nums text-right">{task.percent_complete}%</td>
    </tr>
  )
}

function rowPropsEqual(prev: ScheduleTaskRowProps, next: ScheduleTaskRowProps): boolean {
  if (prev.statusAsOf !== next.statusAsOf) return false
  if (prev.predecessorLabel !== next.predecessorLabel) return false
  if (prev.isCriticalPath !== next.isCriticalPath) return false

  const a = prev.task
  const b = next.task
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.wbs_code === b.wbs_code &&
    a.start_planned === b.start_planned &&
    a.start_current === b.start_current &&
    a.finish_planned === b.finish_planned &&
    a.finish_current === b.finish_current &&
    a.percent_complete === b.percent_complete &&
    a.is_critical === b.is_critical &&
    a.schedule_weight === b.schedule_weight &&
    Boolean(a.is_summary) === Boolean(b.is_summary)
  )
}

export const ScheduleTaskRow = memo(ScheduleTaskRowComponent, rowPropsEqual)
