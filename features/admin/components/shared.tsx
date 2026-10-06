import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Loader2 } from 'lucide-react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  /** Banner image; set false on embedded views (e.g. technical office tabs). */
  showBanner?: boolean
}

export function PageHeader({ title, description, actions, showBanner = true }: PageHeaderProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[12px]',
        showBanner ? 'h-[148px] bg-[#1a2330]' : 'border border-slate-200 bg-white py-4'
      )}
    >
      {showBanner ? (
        <img
          src="/brand/header-banner.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-left"
        />
      ) : null}
      <div
        className={cn(
          'relative flex items-center px-5 sm:px-7',
          showBanner ? 'h-full' : 'min-h-0'
        )}
      >
        <div className="min-w-0 max-w-xl">
          <h1
            className={cn(
              'whitespace-nowrap text-[1.85rem] sm:text-3xl font-extrabold tracking-tight',
              showBanner ? 'text-white drop-shadow-sm' : 'text-slate-900'
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                'mt-1 text-sm font-medium',
                showBanner ? 'text-white/80' : 'text-slate-600'
              )}
            >
              {description}
            </p>
          ) : null}
          {actions ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </section>
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
