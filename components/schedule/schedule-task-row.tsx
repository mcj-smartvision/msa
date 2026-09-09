'use client'

import { memo } from 'react'
import { HelpCircle } from 'lucide-react'
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
  /** Effective weight (parent = sum of children when rolled up). */
  displayWeight?: number | null
  isWeightParent?: boolean
  weightHelpText?: string | null
  weightInvalid?: boolean
  helpOpen?: boolean
  onToggleWeightHelp?: () => void
  onCloseWeightHelp?: () => void
}

function ScheduleTaskRowComponent({
  task,
  predecessorLabel,
  statusAsOf,
  isCriticalPath = false,
  displayWeight,
  isWeightParent = false,
  weightHelpText = null,
  weightInvalid = false,
  helpOpen = false,
  onToggleWeightHelp,
  onCloseWeightHelp,
}: ScheduleTaskRowProps) {
  const depth = wbsDepth(task.wbs_code)
  const indent = depth * INDENT_PX
  const status = getTaskScheduleStatus(task, statusAsOf)
  const start = task.start_planned ?? task.start_current
  const finish = task.finish_planned ?? task.finish_current
  const isOverdue = status === 'overdue'
  const weightValue =
    displayWeight !== undefined ? displayWeight : task.schedule_weight
  const isHeader = Boolean(task.is_summary) || isWeightParent

  return (
    <tr
      className={cn(
        'border-b last:border-0 hover:bg-muted/20',
        isOverdue && 'bg-orange-100/95 border-s-4 border-s-orange-500 hover:bg-orange-100',
        !isOverdue && isCriticalPath && 'bg-red-50/40 hover:bg-red-50/60',
        !isOverdue && isHeader && 'bg-slate-50/80'
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
            isHeader ? 'font-semibold text-foreground' : 'font-medium'
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

      <td className="relative px-3 py-2.5 align-top tabular-nums text-right">
        <div className="inline-flex items-center justify-end gap-0.5">
          <span
            className={cn(
              'inline-block min-w-[2.25rem] rounded px-1.5 py-0.5 text-muted-foreground',
              isWeightParent && 'font-semibold text-sky-950 bg-sky-50',
              weightInvalid &&
                'border-2 border-red-500 bg-red-50 font-semibold text-red-900'
            )}
          >
            {formatScheduleWeight(weightValue)}
          </span>
          {isWeightParent && weightHelpText && onToggleWeightHelp ? (
            <button
              type="button"
              className="rounded-full p-0.5 text-sky-700 hover:bg-sky-100"
              title="وزن سرشاخه از کجا آمده؟"
              aria-label="وزن سرشاخه از کجا آمده؟"
              onClick={(e) => {
                e.stopPropagation()
                onToggleWeightHelp()
              }}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {helpOpen && weightHelpText ? (
          <div
            className="absolute z-30 mt-1 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-medium tabular-nums text-slate-800 shadow-lg"
            style={{ insetInlineEnd: 8 }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{weightHelpText}</span>
            <button
              type="button"
              className="shrink-0 text-[10px] text-sky-700 hover:underline"
              onClick={() => onCloseWeightHelp?.()}
            >
              ×
            </button>
          </div>
        ) : null}
      </td>

      <td className="px-3 py-2.5 align-top tabular-nums text-right">{task.percent_complete}%</td>
    </tr>
  )
}

function rowPropsEqual(prev: ScheduleTaskRowProps, next: ScheduleTaskRowProps): boolean {
  if (prev.statusAsOf !== next.statusAsOf) return false
  if (prev.predecessorLabel !== next.predecessorLabel) return false
  if (prev.isCriticalPath !== next.isCriticalPath) return false
  if (prev.displayWeight !== next.displayWeight) return false
  if (prev.isWeightParent !== next.isWeightParent) return false
  if (prev.weightHelpText !== next.weightHelpText) return false
  if (prev.weightInvalid !== next.weightInvalid) return false
  if (prev.helpOpen !== next.helpOpen) return false

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
