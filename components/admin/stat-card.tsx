import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
  trendType?: 'up' | 'down' | 'neutral' | 'warning'
  className?: string
  compact?: boolean
}

const trendColors = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-muted-foreground',
  warning: 'text-amber-600',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendType = 'neutral',
  className,
  compact,
}: StatCardProps) {
  return (
    <div className={cn('stat-card', compact && 'p-4 rounded-[12px]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn('min-w-0', compact ? 'space-y-1' : 'space-y-2')}>
          <p className="admin-section-title">{label}</p>
          <p className={cn('font-bold tracking-tight text-foreground', compact ? 'text-2xl' : 'text-3xl')}>
            {value}
          </p>
          {trend ? (
            <p className={cn('text-xs font-medium', trendColors[trendType])}>{trend}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary',
            compact ? 'h-9 w-9' : 'h-11 w-11 rounded-xl'
          )}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
      </div>
    </div>
  )
}
