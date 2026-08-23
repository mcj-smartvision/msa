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
  sparkline?: number[]
  caption?: string
  iconTone?: 'ok' | 'info' | 'warn' | 'brand'
}

const trendColors = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-sky-700',
  warning: 'text-amber-700',
}

const iconWell = {
  ok: 'bg-emerald-50 text-emerald-700',
  info: 'bg-sky-50 text-sky-700',
  warn: 'bg-amber-50 text-amber-700',
  brand: 'bg-sky-50 text-sky-700',
}

function Sparkline({ values, tone }: { values: number[]; tone: 'ok' | 'info' | 'warn' }) {
  const width = 120
  const height = 28
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width
      const y = height - ((v - min) / span) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  const stroke = tone === 'warn' ? '#b45309' : tone === 'ok' ? '#047857' : '#0369a1'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-7 w-full" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendType = 'neutral',
  className,
  compact,
  sparkline,
  caption,
  iconTone = 'info',
}: StatCardProps) {
  const sparkTone = trendType === 'warning' ? 'warn' : trendType === 'up' ? 'ok' : 'info'

  return (
    <div className={cn('stat-card', compact && 'p-4 rounded-[12px]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn('min-w-0 flex-1', compact ? 'space-y-1' : 'space-y-2')}>
          <p className="admin-section-title">{label}</p>
          <p className={cn('font-bold tracking-tight text-foreground', compact ? 'text-2xl' : 'text-3xl')}>
            {value}
          </p>
          {caption ? <p className="text-[11px] text-slate-500 leading-snug">{caption}</p> : null}
          {trend ? (
            <p className={cn('text-xs font-medium', trendColors[trendType])}>{trend}</p>
          ) : null}
          {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} tone={sparkTone} /> : null}
        </div>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-[10px]',
            iconWell[iconTone],
            compact ? 'h-9 w-9' : 'h-11 w-11 rounded-xl'
          )}
        >
          <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
      </div>
    </div>
  )
}
