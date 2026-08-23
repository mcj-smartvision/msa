import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/admin/shared'

export function HsePageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} />
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  icon?: LucideIcon
}) {
  const toneBorder =
    tone === 'good'
      ? 'border-l-emerald-600'
      : tone === 'warn'
        ? 'border-l-amber-500'
        : tone === 'bad'
          ? 'border-l-rose-600'
          : 'border-l-slate-400'

  return (
    <div
      className={cn(
        'rounded-md border border-slate-200 border-l-4 bg-white px-3 py-2.5 shadow-sm',
        toneBorder
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-md border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>
}
