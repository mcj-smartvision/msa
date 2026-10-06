'use client'

import { Fragment, memo } from 'react'
import { GitBranch, HelpCircle, Loader2 } from 'lucide-react'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import { CriticalBadge, TaskStatusBadge } from '@/features/schedule/components/task-status-badge'
import type { SchedulePreviewColKey, SchedulePreviewColumn } from '@/features/schedule/lib/schedule-preview-columns'
import { getTaskScheduleStatus } from '@/features/schedule/lib/task-view-date'
import { displayActivityName, wbsDepth } from '@/features/schedule/lib/wbs-utils'
import type { ProjectTask } from '@/shared/types/schedule'
import { UomStack } from '@/features/workshop/components/uom-display'
import { cn } from '@/shared/lib/utils'

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.?0+$/, '')
}

function yesNo(value: boolean | null | undefined): string {
  return value ? 'بله' : '—'
}

const INDENT_PX = 10

export interface ScheduleTaskRowProps {
  task: ProjectTask
  columns: SchedulePreviewColumn[]
  predecessorLabel: string
  statusAsOf: string
  isCriticalPath?: boolean
  displayWeight?: number | null
  /** Effective duration (parent = sum of children). */
  displayDuration?: number | null
  isWeightParent?: boolean
  /** Summary / parent / top-level title row. */
  isHeader?: boolean
  /** First/last row of the top-level title group (used for the outer frame). */
  isGroupFirst?: boolean
  isGroupLast?: boolean
  /** Full-row click highlight */
  isSelected?: boolean
  onSelect?: (modifiers?: { shiftKey: boolean; toggleKey: boolean }) => void
  /** Background for this سر‌تیتر group (header + children) */
  groupBgClass?: string
  contractors?: Array<{ id: string; name: string }>
  contractorId?: string | null
  resolvedContractorId?: string | null
  contractorSaving?: boolean
  onContractorChange?: (contractorId: string | null) => void
  weightHelpText?: string | null
  weightInvalid?: boolean
  helpOpen?: boolean
  stickyOffsets?: { wbs: number; name: number }
  columnWidths?: Partial<Record<SchedulePreviewColKey, number>>
  onToggleWeightHelp?: () => void
  onCloseWeightHelp?: () => void
}

function ScheduleTaskRowComponent({
  task,
  columns,
  predecessorLabel,
  statusAsOf,
  isCriticalPath = false,
  displayWeight,
  displayDuration,
  isWeightParent = false,
  isHeader: isHeaderProp,
  isGroupFirst = false,
  isGroupLast = false,
  isSelected = false,
  onSelect,
  groupBgClass = 'bg-white',
  contractors = [],
  contractorId = null,
  resolvedContractorId = null,
  contractorSaving = false,
  onContractorChange,
  weightHelpText = null,
  weightInvalid = false,
  helpOpen = false,
  stickyOffsets = { wbs: 0, name: 56 },
  columnWidths = {},
  onToggleWeightHelp,
  onCloseWeightHelp,
}: ScheduleTaskRowProps) {
  const depth = wbsDepth(task.wbs_code)
  const indent = depth * INDENT_PX
  const wbsColWidth = columnWidths.wbs ?? 56
  const nameColWidth = columnWidths.name ?? 160
  const status = getTaskScheduleStatus(task, statusAsOf)
  const start = task.start_current ?? task.start_planned
  const finish = task.finish_current ?? task.finish_planned
  const isOverdue = status === 'overdue'
  const weightValue =
    displayWeight !== undefined
      ? displayWeight
      : (task.physical_weight ?? task.schedule_weight)
  const durationValue =
    displayDuration !== undefined ? displayDuration : task.duration_days
  // Prefer explicit prop; fallback keeps older call sites working
  const isHeader =
    isHeaderProp !== undefined
      ? isHeaderProp
      : Boolean(task.is_summary) || isWeightParent || depth === 0
  const physicalPct = task.physical_percent_complete ?? task.percent_complete
  // Group color for header+children; selection wins
  const rowBg = isSelected ? 'bg-sky-100' : groupBgClass
  const stickyBg = isSelected ? 'bg-sky-100' : groupBgClass
  // Keep the WBS title cell in its group color even when the row is selected.
  const wbsBg = isSelected && !isHeader ? 'bg-sky-100' : groupBgClass

  const cell = cn(
    'px-0.5 py-1 align-middle overflow-hidden text-ellipsis whitespace-nowrap tabular-nums text-center border-x-2 border-slate-300'
  )
  const cellMuted = cn(cell, 'text-muted-foreground')
  const resolvedContractor = contractors.find((item) => item.id === resolvedContractorId)
  const isInheritedContractor = !contractorId && Boolean(resolvedContractorId)

  function renderCell(key: SchedulePreviewColKey) {
    switch (key) {
      case 'uid':
        return <td className={cn(cellMuted, 'font-mono')}>{dash(task.external_id ?? task.msp_uid)}</td>
      case 'wbs':
        return (
          <td
            className={cn(
              cellMuted,
              'sticky z-20 font-mono text-center overflow-hidden',
              wbsBg,
              isHeader && 'font-bold text-slate-950'
            )}
            style={{
              right: stickyOffsets.wbs,
              width: wbsColWidth,
              minWidth: wbsColWidth,
              maxWidth: wbsColWidth,
              paddingInlineStart: `${4 + indent}px`,
            }}
          >
            {dash(task.wbs_code)}
          </td>
        )
      case 'outline_number':
        return <td className={cellMuted}>{dash(task.outline_number)}</td>
      case 'outline_level':
        return <td className={cellMuted}>{dash(task.outline_level)}</td>
      case 'name':
        return (
          <td
            className={cn(
              'px-1 py-1 align-middle sticky z-30 overflow-hidden border-x-2 border-slate-500 text-right',
              stickyBg
            )}
            style={{
              right: stickyOffsets.name,
              width: nameColWidth,
              minWidth: nameColWidth,
              maxWidth: nameColWidth,
              paddingInlineStart: `${4 + indent}px`,
              boxShadow:
                '-1px 0 0 0 rgb(100, 116, 139), -6px 0 10px -4px rgba(15, 23, 42, 0.25)',
            }}
          >
            <span
              className={cn(
                'block truncate leading-tight',
                isHeader ? 'font-bold text-slate-950' : 'font-medium'
              )}
              title={displayActivityName(task.name, task.wbs_code)}
            >
              {displayActivityName(task.name, task.wbs_code)}
            </span>
          </td>
        )
      case 'contractor':
        return (
          <td className="relative z-0 px-1 py-1 align-middle overflow-hidden border-x-2 border-slate-300 text-right">
            <div className="flex min-w-0 items-center gap-1" dir="rtl">
              {isInheritedContractor ? (
                <GitBranch
                  className="h-3 w-3 shrink-0 text-slate-400"
                  aria-label="به ارث رسیده"
                />
              ) : null}
              <select
                value={contractorId ?? ''}
                disabled={contractorSaving || !onContractorChange}
                title={
                  isInheritedContractor
                    ? `به ارث رسیده از سرشاخه: ${resolvedContractor?.name ?? 'پیمانکار'}`
                    : 'تخصیص مستقیم پیمانکار'
                }
                className={cn(
                  'h-7 min-w-0 w-full max-w-full rounded border border-slate-300 bg-white px-1 text-[10px] outline-none focus:border-sky-500',
                  isInheritedContractor && 'text-slate-500'
                )}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation()
                  onContractorChange?.(event.target.value || null)
                }}
              >
                <option value="">
                  {resolvedContractor
                    ? resolvedContractor.name
                    : 'بدون پیمانکار'}
                </option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
              {contractorSaving ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-sky-700" />
              ) : null}
            </div>
          </td>
        )
      case 'quantity':
        return (
          <td className={cell}>
            {task.schedule_quantity != null && Number(task.schedule_quantity) > 0
              ? formatNum(task.schedule_quantity)
              : '—'}
          </td>
        )
      case 'uom':
        return (
          <td className={cellMuted}>
            <UomStack uom={task.schedule_uom} />
          </td>
        )
      case 'unit_price':
        return (
          <td className={cell}>
            {task.unit_price != null && Number(task.unit_price) > 0
              ? formatNum(task.unit_price)
              : '—'}
          </td>
        )
      case 'is_summary':
        return null
      case 'is_milestone':
        return <td className={cell}>{yesNo(task.is_milestone)}</td>
      case 'obs_code':
        return <td className={cellMuted}>{dash(task.obs_code)}</td>
      case 'cbs_code':
        return <td className={cellMuted}>{dash(task.cbs_code)}</td>
      case 'duration_days':
        return <td className={cell}>{formatNum(durationValue)}</td>
      case 'remaining_duration_days':
        return <td className={cell}>{formatNum(task.remaining_duration_days)}</td>
      case 'planned_start':
        return (
          <td className={cell}>
            <FormattedDate value={start} />
          </td>
        )
      case 'planned_finish':
        return (
          <td className={cell}>
            <FormattedDate value={finish} />
          </td>
        )
      case 'constraint_type':
        return <td className={cellMuted}>{dash(task.constraint_type)}</td>
      case 'constraint_date':
        return (
          <td className={cell}>
            <FormattedDate value={task.constraint_date} />
          </td>
        )
      case 'deadline':
        return (
          <td className={cell}>
            <FormattedDate value={task.deadline} />
          </td>
        )
      case 'baseline_start':
        return (
          <td className={cell}>
            <FormattedDate value={task.baseline_start} />
          </td>
        )
      case 'baseline_finish':
        return (
          <td className={cell}>
            <FormattedDate value={task.baseline_finish} />
          </td>
        )
      case 'baseline_duration_days':
        return <td className={cell}>{formatNum(task.baseline_duration_days)}</td>
      case 'baseline_cost':
        return <td className={cell}>{formatNum(task.baseline_cost)}</td>
      case 'baseline_work_hours':
        return <td className={cell}>{formatNum(task.baseline_work_hours)}</td>
      case 'percent_complete':
        return <td className={cell}>{formatNum(physicalPct, 1)}%</td>
      case 'physical_percent_complete':
        return null
      case 'actual_start':
        return (
          <td className={cell}>
            <FormattedDate value={task.actual_start} />
          </td>
        )
      case 'actual_finish':
        return (
          <td className={cell}>
            <FormattedDate value={task.actual_finish} />
          </td>
        )
      case 'work_hours':
        return <td className={cell}>{formatNum(task.work_hours)}</td>
      case 'cost':
        return <td className={cell}>{formatNum(task.cost)}</td>
      case 'physical_weight':
        return (
          <td className="relative px-0.5 py-1 align-middle tabular-nums text-center overflow-visible border-x-2 border-slate-300">
            <div className="inline-flex items-center justify-center gap-0.5 max-w-full">
              <span
                className={cn(
                  'inline-block rounded px-0.5 text-muted-foreground truncate',
                  isWeightParent && 'font-semibold text-sky-950 bg-sky-50',
                  weightInvalid &&
                    'border border-red-500 bg-red-50 font-semibold text-red-900'
                )}
              >
                {formatNum(weightValue)}
              </span>
              {isWeightParent && weightHelpText && onToggleWeightHelp ? (
                <button
                  type="button"
                  className="rounded-full p-0 text-sky-700 hover:bg-sky-100"
                  title="وزن سرشاخه از کجا آمده؟"
                  aria-label="وزن سرشاخه از کجا آمده؟"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleWeightHelp()
                  }}
                >
                  <HelpCircle className="h-2.5 w-2.5" />
                </button>
              ) : null}
            </div>
            {helpOpen && weightHelpText ? (
              <div
                className="absolute z-30 mt-1 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-sky-200 bg-white px-2 py-1 text-[10px] font-medium tabular-nums text-slate-800 shadow-lg"
                style={{ insetInlineEnd: 4 }}
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
        )
      case 'notes':
        return (
          <td className={cn(cellMuted)} title={task.notes ?? undefined}>
            {dash(task.notes)}
          </td>
        )
      case 'flag':
        return <td className={cell}>{yesNo(task.flag)}</td>
      case 'priority':
        return <td className={cell}>{dash(task.priority)}</td>
      case 'is_manual_scheduled':
        return <td className={cell}>{yesNo(task.is_manual_scheduled)}</td>
      case 'has_split':
        return <td className={cell}>{yesNo(task.has_split)}</td>
      case 'is_recurring_master':
        return <td className={cell}>{yesNo(task.is_recurring_master)}</td>
      case 'predecessors':
        return (
          <td className={cn(cellMuted, 'font-mono text-[10px]')} title={predecessorLabel}>
            {predecessorLabel}
          </td>
        )
      case 'status':
        return (
          <td className={cn('px-0.5 py-1 align-middle text-center overflow-hidden border-x-2 border-slate-300')}>
            <TaskStatusBadge status={status} />
          </td>
        )
      case 'is_critical':
        return (
          <td className={cn('px-0.5 py-1 align-middle text-center border-x-2 border-slate-300')}>
            {task.is_critical || isCriticalPath ? (
              <CriticalBadge compact />
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )}
          </td>
        )
      case 'total_float_days':
        return <td className={cell}>{formatNum(task.total_float_days)}</td>
      case 'free_float_days':
        return <td className={cell}>{formatNum(task.free_float_days)}</td>
      default:
        return <td className={cellMuted}>—</td>
    }
  }

  return (
    <tr
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={(event) =>
        onSelect?.({
          shiftKey: event.shiftKey,
          toggleKey: event.ctrlKey || event.metaKey,
        })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      className={cn(
        'border-b border-slate-300 last:border-0 cursor-pointer hover:brightness-[0.98]',
        rowBg,
        isOverdue && !isHeader && 'border-s-4 border-s-orange-500',
        // One thick outer frame around the top-level title and all its descendants.
        '[&>td:first-child]:border-s-2 [&>td:first-child]:border-s-slate-900',
        '[&>td:last-child]:border-e-2 [&>td:last-child]:border-e-slate-900',
        isGroupFirst &&
          '[&>td]:border-t-2 [&>td]:border-t-slate-900',
        isGroupLast &&
          '[&>td]:border-b-2 [&>td]:border-b-slate-900',
        isHeader &&
          'font-semibold',
        isSelected &&
          !isHeader &&
          'relative z-[3] bg-sky-100 shadow-[inset_0_0_0_2px_#0369a1]',
        isSelected && isHeader && 'bg-sky-50'
      )}
    >
      {columns.map((col) => (
        <Fragment key={col.key}>{renderCell(col.key)}</Fragment>
      ))}
    </tr>
  )
}

function rowPropsEqual(prev: ScheduleTaskRowProps, next: ScheduleTaskRowProps): boolean {
  if (prev.statusAsOf !== next.statusAsOf) return false
  if (prev.predecessorLabel !== next.predecessorLabel) return false
  if (prev.isCriticalPath !== next.isCriticalPath) return false
  if (prev.displayWeight !== next.displayWeight) return false
  if (prev.displayDuration !== next.displayDuration) return false
  if (prev.isWeightParent !== next.isWeightParent) return false
  if (prev.isHeader !== next.isHeader) return false
  if (prev.isGroupFirst !== next.isGroupFirst) return false
  if (prev.isGroupLast !== next.isGroupLast) return false
  if (prev.isSelected !== next.isSelected) return false
  if (prev.groupBgClass !== next.groupBgClass) return false
  if (prev.contractors !== next.contractors) return false
  if (prev.contractorId !== next.contractorId) return false
  if (prev.resolvedContractorId !== next.resolvedContractorId) return false
  if (prev.contractorSaving !== next.contractorSaving) return false
  if (prev.weightHelpText !== next.weightHelpText) return false
  if (prev.weightInvalid !== next.weightInvalid) return false
  if (prev.helpOpen !== next.helpOpen) return false
  if (prev.columns !== next.columns) {
    if (prev.columns.length !== next.columns.length) return false
    for (let i = 0; i < prev.columns.length; i++) {
      if (prev.columns[i].key !== next.columns[i].key) return false
    }
  }
  if (
    prev.stickyOffsets?.wbs !== next.stickyOffsets?.wbs ||
    prev.stickyOffsets?.name !== next.stickyOffsets?.name
  ) {
    return false
  }
  if (
    (prev.columnWidths?.wbs ?? 56) !== (next.columnWidths?.wbs ?? 56) ||
    (prev.columnWidths?.name ?? 160) !== (next.columnWidths?.name ?? 160)
  ) {
    return false
  }
  return prev.task === next.task || prev.task.updated_at === next.task.updated_at
}

export const ScheduleTaskRow = memo(ScheduleTaskRowComponent, rowPropsEqual)
