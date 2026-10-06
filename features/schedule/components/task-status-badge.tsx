'use client'

import { Badge } from '@/shared/components/ui/badge'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
TASK_STATUS_LABELS,
type TaskScheduleStatus,
} from '@/features/schedule/lib/task-view-date'
import { cn } from '@/shared/lib/utils'

const STATUS_STYLES: Record<TaskScheduleStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-sky-100 text-sky-800 border-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
}

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskScheduleStatus
  className?: string
}) {
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const label = fa ? TASK_STATUS_LABELS[status].fa : TASK_STATUS_LABELS[status].en

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-medium whitespace-nowrap border', STATUS_STYLES[status], className)}
    >
      {label}
    </Badge>
  )
}

export function CriticalBadge({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { locale } = useLocale()
  const fa = locale === 'fa'

  return (
    <Badge
      className={cn(
        'shrink-0 font-bold uppercase tracking-wide bg-red-600 text-white hover:bg-red-600 border-0 shadow-sm',
        compact ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5',
        className
      )}
      title={fa ? 'مسیر بحرانی' : 'Critical path'}
    >
      {compact ? (fa ? 'بحرانی' : 'Crit') : fa ? 'بحرانی' : 'Critical'}
    </Badge>
  )
}
