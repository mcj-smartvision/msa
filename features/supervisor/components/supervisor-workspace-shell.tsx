/**
 * @file features/supervisor/components/supervisor-workspace-shell.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (supervisor-workspace-shell)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on shared/lib/utils, shared/components/layout/last-presence-sidebar-footer, features/supervisor/components/supervisor-mobile-nav
 */

'use client'

import { cn } from '@/shared/lib/utils'
import { LastPresenceSidebarFooter } from '@/shared/components/layout/last-presence-sidebar-footer'
import { SupervisorMobileNav } from '@/features/supervisor/components/supervisor-mobile-nav'
import type { SupervisorNavId, SupervisorNavItem } from '@/features/supervisor/lib/nav-types'
import { siteSupervisorT } from '@/shared/lib/i18n/site-supervisor'
import { useLocale } from '@/shared/components/i18n/locale-provider'

export type { SupervisorNavId, SupervisorNavItem }

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
  const { dir } = useLocale()
  const t = siteSupervisorT
  const active = items.find((i) => i.id === activeId)

  return (
    <div
      className={cn(
        'grid gap-2 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-3',
        'pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0',
        className
      )}
      dir={dir}
    >
      <div className="hidden flex-col gap-2 lg:sticky lg:top-3 lg:flex">
        <nav
          aria-label={t.navAria}
          className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
        >
          <p className="mb-2 px-2 text-[11px] font-semibold text-slate-500">{t.sectionsList}</p>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const selected = item.id === activeId
              const showBadge = typeof item.badge === 'number' && item.badge > 0
              return (
                <li key={item.id} className="w-full">
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
                        title={item.badgeTitle}
                        aria-label={item.badgeTitle ?? t.notificationCount(item.badge)}
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
        <LastPresenceSidebarFooter />
      </div>

      <section className="min-w-0 rounded-none border-0 bg-transparent shadow-none lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm">
        <header className="border-b border-slate-200/80 bg-white px-3 py-2.5 lg:rounded-t-lg lg:px-4 lg:py-3">
          <h2 className="text-base font-semibold text-slate-900">{active?.label}</h2>
          {active?.hint ? (
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{active.hint}</p>
          ) : null}
        </header>
        <div className="bg-white p-2 sm:p-3 lg:rounded-b-lg lg:p-4">{children}</div>
      </section>

      <SupervisorMobileNav items={items} activeId={activeId} onSelect={onSelect} />
    </div>
  )
}
