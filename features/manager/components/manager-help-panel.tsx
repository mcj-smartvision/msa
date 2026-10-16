/**
 * @file features/manager/components/manager-help-panel.tsx
 * @purpose کامپوننت UI — داشبورد مدیر پروژه و KPI (manager-help-panel)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on shared/lib/utils, features/manager/lib/format, features/manager/config
 */

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import {
AlertTriangle,
ArrowLeft,
BookOpen,
CheckCircle2,
Compass,
Keyboard,
OctagonAlert,
Palette,
PlayCircle,
Rocket,
Unplug,
X,
Zap,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber } from '@/features/manager/lib/format'
import { MANAGER_HELP_COPY } from '@/features/manager/config'

export interface ManagerHelpLink {
  label: string
  description: string
  href: string
}

type TabId = 'tour' | 'glossary' | 'colors' | 'shortcuts'

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'tour', label: MANAGER_HELP_COPY.tabs.tour, icon: Rocket },
  { id: 'glossary', label: MANAGER_HELP_COPY.tabs.glossary, icon: BookOpen },
  { id: 'colors', label: MANAGER_HELP_COPY.tabs.colors, icon: Palette },
  { id: 'shortcuts', label: MANAGER_HELP_COPY.tabs.shortcuts, icon: Zap },
]

function Term({ abbr, name, title, children }: { abbr: string; name: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs">
      <dt className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary" dir="ltr">
          {abbr}
        </span>
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <span className="text-[11px] text-slate-400" dir="ltr">
          {name}
        </span>
      </dt>
      <dd className="mt-2 text-xs leading-6 text-slate-600">{children}</dd>
    </div>
  )
}

function ColorRow({
  chip,
  icon: Icon,
  label,
  title,
  children,
}: {
  chip: string
  icon: ComponentType<{ className?: string }>
  label: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs">
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', chip)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        <span className="text-sm font-bold text-slate-800">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-600">{children}</p>
    </li>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[26px] items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-slate-700 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
      {children}
    </kbd>
  )
}

export function ManagerHelpPanel({
  open,
  onClose,
  onStartTour,
  steps,
  links,
  unavailable,
}: {
  open: boolean
  onClose: () => void
  onStartTour: () => void
  steps: { title: string; body: string }[]
  links: ManagerHelpLink[]
  unavailable: string[]
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ tour: null, glossary: null, colors: null, shortcuts: null })
  const [tab, setTab] = useState<TabId>('tour')

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onTabKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab)
    let next = index
    // RTL: the visually next tab sits to the left.
    if (event.key === 'ArrowLeft') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowRight') next = (index - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    else return
    event.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  return (
    <div className="fixed inset-0 z-[70]" dir="rtl">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200 motion-reduce:animate-none"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-help-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-slate-200/70 bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-300 ease-out motion-reduce:animate-none"
      >
        <header className="border-b border-slate-100 bg-white px-5 pb-0 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-primary text-white shadow-sm">
                <Compass className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="manager-help-title" className="text-base font-bold text-slate-800">
                  {MANAGER_HELP_COPY.title}
                </h2>
                <p className="text-xs text-slate-500">{MANAGER_HELP_COPY.subtitle}</p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={MANAGER_HELP_COPY.close}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div role="tablist" aria-label={MANAGER_HELP_COPY.tablist} onKeyDown={onTabKey} className="mt-4 flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const selected = tab === t.id
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el
                  }}
                  type="button"
                  role="tab"
                  id={`manager-help-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`manager-help-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 pb-3 pt-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60',
                    selected ? 'font-bold text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.label}
                  {selected ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
                </button>
              )
            })}
          </div>
        </header>

        <div
          role="tabpanel"
          id={`manager-help-panel-${tab}`}
          aria-labelledby={`manager-help-tab-${tab}`}
          className="flex-1 overflow-y-auto p-5"
        >
          {tab === 'tour' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-l from-orange-50 to-white p-4">
                <p className="text-sm font-bold text-slate-800">{MANAGER_HELP_COPY.tourInteractive(faNumber(steps.length))}</p>
                <p className="mt-1 text-xs leading-6 text-slate-600">{MANAGER_HELP_COPY.tourIntro}</p>
                <button
                  type="button"
                  onClick={onStartTour}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden />
                  {MANAGER_HELP_COPY.startTour}
                </button>
              </div>
              <ol className="relative space-y-3 border-r-2 border-dashed border-slate-200 pr-5">
                {steps.map((step, index) => (
                  <li key={step.title} className="relative">
                    <span className="absolute -right-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold tabular-nums text-primary ring-2 ring-primary/30">
                      {faNumber(index + 1)}
                    </span>
                    <p className="text-sm font-bold text-slate-800">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-6 text-slate-500">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {tab === 'glossary' ? (
            <dl className="space-y-2.5">
              {MANAGER_HELP_COPY.glossary.map((term) => (
                <Term key={term.abbr} abbr={term.abbr} title={term.title} name={term.name}>
                  {term.body}
                </Term>
              ))}
            </dl>
          ) : null}

          {tab === 'colors' ? (
            <div className="space-y-3">
              <ul className="space-y-2.5">
                {(
                  [
                    ['bg-emerald-500/10 text-emerald-700 ring-emerald-600/15', CheckCircle2],
                    ['bg-amber-500/10 text-amber-700 ring-amber-600/15', AlertTriangle],
                    ['bg-rose-500/10 text-rose-700 ring-rose-600/15', OctagonAlert],
                    ['bg-slate-500/10 text-slate-600 ring-slate-500/15', Unplug],
                  ] as const
                ).map(([chip, icon], i) => {
                  const row = MANAGER_HELP_COPY.colors[i]
                  return (
                    <ColorRow key={row.title} chip={chip} icon={icon} label={row.label} title={row.title}>
                      {row.body}
                    </ColorRow>
                  )
                })}
              </ul>
              <p className="rounded-xl bg-white px-3.5 py-3 text-xs leading-6 text-slate-500 ring-1 ring-slate-100">
                {MANAGER_HELP_COPY.colorsNote}
              </p>
            </div>
          ) : null}

          {tab === 'shortcuts' ? (
            <div className="space-y-5">
              <section aria-labelledby="help-quick-links">
                <h3 id="help-quick-links" className="mb-2 text-xs font-bold text-slate-800">
                  {MANAGER_HELP_COPY.quickLinks}
                </h3>
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-xs transition-all duration-200 hover:border-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-800">{link.label}</span>
                          <span className="block truncate text-xs text-slate-500">{link.description}</span>
                        </span>
                        <ArrowLeft
                          className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:-translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="help-keys">
                <h3 id="help-keys" className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Keyboard className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {MANAGER_HELP_COPY.shortcutsTitle}
                </h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white text-xs text-slate-600 shadow-xs">
                  <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    {MANAGER_HELP_COPY.shortcutOpen}
                    <Kbd>?</Kbd>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    {MANAGER_HELP_COPY.shortcutClose}
                    <Kbd>Esc</Kbd>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    {MANAGER_HELP_COPY.shortcutTour}
                    <span className="flex gap-1">
                      <Kbd>←</Kbd>
                      <Kbd>→</Kbd>
                    </span>
                  </li>
                </ul>
              </section>

              <section aria-labelledby="help-tips">
                <h3 id="help-tips" className="mb-2 text-xs font-bold text-slate-800">
                  {MANAGER_HELP_COPY.tipsTitle}
                </h3>
                <ul className="space-y-2 text-xs leading-6 text-slate-600">
                  <li className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100">
                    {MANAGER_HELP_COPY.tipOnEach}
                    <strong className="text-slate-800">{MANAGER_HELP_COPY.tipHealthLead}</strong>
                    {MANAGER_HELP_COPY.tipHealth}
                  </li>
                  <li className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100">
                    <strong className="text-slate-800">{MANAGER_HELP_COPY.tipPeriodLead}</strong>
                    {MANAGER_HELP_COPY.tipPeriod}
                  </li>
                  <li className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100">
                    {MANAGER_HELP_COPY.tipRefresh}
                  </li>
                  <li className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100">
                    {MANAGER_HELP_COPY.tipInfoPrefix}
                    <strong className="text-slate-800">{MANAGER_HELP_COPY.tipInfoLead}</strong>
                    {MANAGER_HELP_COPY.tipInfo}
                  </li>
                </ul>
              </section>

              {unavailable.length > 0 ? (
                <div className="rounded-xl bg-slate-100/80 p-3.5 text-xs leading-6 text-slate-600">
                  <p className="font-bold text-slate-700">{MANAGER_HELP_COPY.unavailableTitle}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pr-4">
                    {unavailable.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
