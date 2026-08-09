'use client'

import { cn } from '@/lib/utils'

export type SupervisorNavId =
  | 'safety'
  | 'overview'
  | 'workshop'
  | 'today'
  | 'lookahead'
  | 'issues'
  | 'resources'
  | 'ai'

export type SupervisorNavItem = {
  id: SupervisorNavId
  label: string
  hint?: string
  badge?: number
  badgeTone?: 'danger' | 'neutral'
}

export function SupervisorWorkspaceShell({
  items,
  activeId,
  onSelect,
  children,
  className,
}: {
  items: SupervisorNavItem[]
  activeId: SupervisorNavId
  onSelect: (id: SupervisorNavId) => void
  children: React.ReactNode
  className?: string
}) {
  const active = items.find((i) => i.id === activeId)

  return (
    <div
      className={cn(
        'grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start',
        className
      )}
      dir="rtl"
    >
      {/* سمت راست: تیترها */}
      <nav
        aria-label="بخش‌های داشبورد سرپرست"
        className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-3"
      >
        <p className="mb-2 px-2 text-[11px] font-semibold text-slate-500">فهرست بخش‌ها</p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {items.map((item) => {
            const selected = item.id === activeId
            const showBadge = typeof item.badge === 'number' && item.badge > 0
            return (
              <li key={item.id} className="shrink-0 lg:w-full">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'relative flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-right text-sm font-medium transition-colors',
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {showBadge ? (
                    <span
                      className={cn(
                        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        item.badgeTone === 'danger' || item.id === 'safety'
                          ? selected
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-600 text-white'
                          : selected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-700'
                      )}
                      aria-label={`${item.badge} اعلان`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* سمت چپ: محتوا */}
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{active?.label}</h2>
          {active?.hint ? <p className="mt-0.5 text-xs text-slate-500">{active.hint}</p> : null}
        </header>
        <div className="p-3 sm:p-4">{children}</div>
      </section>
    </div>
  )
}
