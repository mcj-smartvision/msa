/**
 * @file features/supervisor/components/supervisor-mobile-nav.tsx
 * @purpose ناوبری پایین موبایل داشبورد سرپرست کارگاه
 * @safe-to-edit YES
 * @affects داشبورد سرپرست کارگاه
 * @depends-on features/supervisor/lib/mobile-nav-config, shared/lib/i18n/site-supervisor, shared/lib/utils
 */

'use client'

import { useEffect, useId, useState } from 'react'
import { ClipboardList, Gauge, Menu, ShieldAlert, X } from 'lucide-react'
import {
  SUPERVISOR_MOBILE_PRIMARY_IDS,
  isSupervisorMobilePrimary,
} from '@/features/supervisor/lib/mobile-nav-config'
import type { SupervisorNavId, SupervisorNavItem } from '@/features/supervisor/lib/nav-types'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'
import { cn } from '@/shared/lib/utils'

const PRIMARY_ICONS = {
  'daily-progress': Gauge,
  'daily-report': ClipboardList,
  safety: ShieldAlert,
} as const

function shortLabel(id: (typeof SUPERVISOR_MOBILE_PRIMARY_IDS)[number], t: ReturnType<typeof getSiteSupervisorMessages>) {
  if (id === 'daily-progress') return t.shortNavProgress
  if (id === 'daily-report') return t.shortNavReport
  return t.shortNavSafety
}

export function SupervisorMobileNav({
  items,
  activeId,
  onSelect,
}: {
  items: SupervisorNavItem[]
  activeId: SupervisorNavId
  onSelect: (id: SupervisorNavId) => void
}) {
  const t = getSiteSupervisorMessages('fa')
  const [moreOpen, setMoreOpen] = useState(false)
  const titleId = useId()
  const byId = new Map(items.map((item) => [item.id, item]))
  const primaryItems = SUPERVISOR_MOBILE_PRIMARY_IDS.map((id) => byId.get(id)).filter(
    (item): item is SupervisorNavItem => item != null
  )
  const moreItems = items.filter((item) => !isSupervisorMobilePrimary(item.id))
  const moreActive = !isSupervisorMobilePrimary(activeId)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [moreOpen])

  function pick(id: SupervisorNavId) {
    onSelect(id)
    setMoreOpen(false)
  }

  return (
    <>
      <nav
        aria-label={t.navAria}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1 pt-1 shadow-[0_-4px_16px_-6px_rgba(15,23,42,0.18)] backdrop-blur lg:hidden pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-0.5">
          {primaryItems.map((item) => {
            const selected = item.id === activeId
            const Icon = PRIMARY_ICONS[item.id as keyof typeof PRIMARY_ICONS]
            const showBadge = typeof item.badge === 'number' && item.badge > 0
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item.id)}
                  className={cn(
                    'relative flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors',
                    selected ? 'bg-primary/12 text-primary' : 'text-slate-600 active:bg-slate-100'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="truncate">{shortLabel(item.id as keyof typeof PRIMARY_ICONS, t)}</span>
                  {showBadge ? (
                    <span
                      className="absolute end-2 top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white tabular-nums"
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
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors',
                moreActive || moreOpen ? 'bg-primary/12 text-primary' : 'text-slate-600 active:bg-slate-100'
              )}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
            >
              <Menu className="h-5 w-5" aria-hidden />
              <span>{t.navMore}</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label={t.close}
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
              <h2 id={titleId} className="text-sm font-bold text-slate-900">
                {t.navMoreTitle}
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="divide-y divide-slate-100 px-2 py-1">
              {moreItems.map((item) => {
                const selected = item.id === activeId
                const showBadge = typeof item.badge === 'number' && item.badge > 0
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pick(item.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3.5 text-right text-sm font-medium transition-colors',
                        selected ? 'bg-slate-900 text-white' : 'text-slate-800 active:bg-slate-50'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.hint ? (
                          <span
                            className={cn(
                              'mt-0.5 block text-[11px] font-normal',
                              selected ? 'text-white/70' : 'text-slate-500'
                            )}
                          >
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                      {showBadge ? (
                        <span
                          className={cn(
                            'inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            item.badgeTone === 'danger'
                              ? 'bg-rose-600 text-white'
                              : selected
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 text-slate-700'
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
