/**
 * @file features/schedule/components/task-status-badge.tsx
 * @purpose کامپوننت UI — زمان‌بندی، WBS و گانت (task-status-badge)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on shared/components/ui/badge, shared/components/i18n/locale-provider, features/schedule/lib/task-view-date, shared/lib/utils, features/schedule/config
 */

'use client'

import { Badge } from '@/shared/components/ui/badge'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import {
TASK_STATUS_LABELS,
type TaskScheduleStatus,
} from '@/features/schedule/lib/task-view-date'
import { cn } from '@/shared/lib/utils'
import { TASK_STATUS_COPY } from '@/features/schedule/config'

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
      title={fa ? TASK_STATUS_COPY.criticalPath : 'Critical path'}
    >
      {compact
        ? fa
          ? TASK_STATUS_COPY.critical
          : 'Crit'
        : fa
          ? TASK_STATUS_COPY.critical
          : 'Critical'}
    </Badge>
  )
}
