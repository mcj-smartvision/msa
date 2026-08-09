import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between pb-1">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 sm:p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
      )}
    >
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
      {active ? 'فعال' : 'غیرفعال'}
    </span>
  )
}

export function LoadingBlock({ label = 'در حال بارگذاری...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
      <p className="font-medium">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="underline mt-2 text-destructive/80 hover:text-destructive">
          تلاش مجدد
        </button>
      ) : null}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-card overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-4 border-b bg-muted/20 px-5 py-4">
        <div>
          <h3 className="font-semibold text-base">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
