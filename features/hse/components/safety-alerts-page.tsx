/**
 * @file features/hse/components/safety-alerts-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (safety-alerts-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/format, shared/lib/utils, features/hse/lib/safety-alert-mocks, features/hse/config
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
CheckCircle2,
Clock,
ExternalLink,
LayoutGrid,
MapPin,
Play,
Video,
X,
} from 'lucide-react'
import { formatDateTime } from '@/features/hse/components/format'
import { cn } from '@/shared/lib/utils'
import {
  MOCK_SAFETY_ALERTS,
  countOpenSafetyAlertMocks,
  type SafetyAlertMockItem,
  type SafetyQueueBucket,
} from '@/features/hse/lib/safety-alert-mocks'
import type { IncidentStatus, Severity } from '@/features/hse/lib/types'
import { HSE_SAFETY_ALERTS_COPY } from '@/features/hse/config'

export type { SafetyAlertMockItem, SafetyQueueBucket }
export { countOpenSafetyAlertMocks }

/** رنگ‌بندی یکدست — قرمز / زرد / سبز */
const TONE = {
  critical: {
    chip: 'border-rose-200 bg-rose-50 text-rose-900',
    chipActive: 'border-rose-400 bg-rose-100 ring-2 ring-rose-300/60',
    value: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800 border border-rose-200',
    border: 'border-r-rose-500',
    action: 'bg-rose-600 hover:bg-rose-700',
  },
  needs_review: {
    chip: 'border-amber-200 bg-amber-50 text-amber-950',
    chipActive: 'border-amber-400 bg-amber-100 ring-2 ring-amber-300/60',
    value: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-900 border border-amber-200',
    border: 'border-r-amber-400',
    action: 'bg-rose-600 hover:bg-rose-700',
  },
  solved: {
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    chipActive: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300/60',
    value: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    border: 'border-r-emerald-500',
    action: 'bg-emerald-600 hover:bg-emerald-700',
  },
} as const

const SITE_NAVY = 'bg-[#1e3a5f]'

const MOCK_NAV_ITEMS: Array<{ id: string; label: string; badge?: number }> = [
  { id: 'safety', label: HSE_SAFETY_ALERTS_COPY.nav.safety, badge: countOpenSafetyAlertMocks() },
  { id: 'overview', label: HSE_SAFETY_ALERTS_COPY.nav.overview },
  { id: 'workshop', label: HSE_SAFETY_ALERTS_COPY.nav.workshop },
  { id: 'drawings', label: HSE_SAFETY_ALERTS_COPY.nav.drawings },
  { id: 'inspection', label: HSE_SAFETY_ALERTS_COPY.nav.inspection },
  { id: 'today', label: HSE_SAFETY_ALERTS_COPY.nav.today },
  { id: 'lookahead', label: HSE_SAFETY_ALERTS_COPY.nav.lookahead },
  { id: 'issues', label: HSE_SAFETY_ALERTS_COPY.nav.issues },
  { id: 'resources', label: HSE_SAFETY_ALERTS_COPY.nav.resources },
  { id: 'ai', label: HSE_SAFETY_ALERTS_COPY.nav.ai },
]

const ACTIVE_NAV_ID = 'safety'

const SUPERVISOR_RETURN = '/dashboard/site-supervisor'

export function incidentDetailHref(incidentId: string, returnTo?: string): string {
  const fromSupervisor = returnTo?.includes('site-supervisor')
  const base = fromSupervisor
    ? `/dashboard/site-supervisor/incidents/${incidentId}`
    : `/dashboard/hse/incidents/${incidentId}`
  if (!returnTo) return base
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`
}

const FILTER_CHIPS = [
  { id: 'all', label: HSE_SAFETY_ALERTS_COPY.filters.all },
  { id: 'critical', label: HSE_SAFETY_ALERTS_COPY.filters.critical },
  { id: 'my_action', label: HSE_SAFETY_ALERTS_COPY.filters.my_action },
  { id: 'escalated', label: HSE_SAFETY_ALERTS_COPY.filters.escalated },
  { id: 'ai_review', label: HSE_SAFETY_ALERTS_COPY.filters.ai_review },
  { id: 'resolved', label: HSE_SAFETY_ALERTS_COPY.filters.resolved },
] as const

type FilterChipId = (typeof FILTER_CHIPS)[number]['id']
type SummaryFilterId = SafetyQueueBucket

export function openSafetyAlertsTitle(count: number): string {
  return HSE_SAFETY_ALERTS_COPY.openTitle(count)
}

function countByBucket(bucket: SafetyQueueBucket): number {
  return MOCK_SAFETY_ALERTS.filter((i) => i.queueBucket === bucket).length
}

function formatMinutesAgoFa(minutes: number): string {
  if (minutes < 60) return HSE_SAFETY_ALERTS_COPY.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (rem === 0) return HSE_SAFETY_ALERTS_COPY.hoursAgo(hours)
  return HSE_SAFETY_ALERTS_COPY.hoursMinutesAgo(hours, rem)
}

const SOFT_SEVERITY: Record<Severity, { label: string; className: string }> = {
  critical: { label: HSE_SAFETY_ALERTS_COPY.softSeverity.critical, className: TONE.critical.badge },
  high: { label: HSE_SAFETY_ALERTS_COPY.softSeverity.high, className: 'bg-amber-100 text-amber-900 border border-amber-200' },
  medium: { label: HSE_SAFETY_ALERTS_COPY.softSeverity.medium, className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  low: { label: HSE_SAFETY_ALERTS_COPY.softSeverity.low, className: 'bg-slate-100 text-slate-600 border border-slate-200' },
}

const SOFT_STATUS: Partial<Record<IncidentStatus, { label: string; className: string }>> = {
  assigned: { label: HSE_SAFETY_ALERTS_COPY.softStatus.assigned, className: 'bg-sky-100 text-sky-800 border border-sky-200' },
  escalated: { label: HSE_SAFETY_ALERTS_COPY.softStatus.escalated, className: 'bg-violet-100 text-violet-800 border border-violet-200' },
  ai_review: { label: HSE_SAFETY_ALERTS_COPY.softStatus.ai_review, className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  confirmed: { label: HSE_SAFETY_ALERTS_COPY.softStatus.confirmed, className: 'bg-rose-100 text-rose-800 border border-rose-200' },
  closed: { label: HSE_SAFETY_ALERTS_COPY.softStatus.closed, className: TONE.solved.badge },
}

function filterByChip(items: SafetyAlertMockItem[], chip: FilterChipId): SafetyAlertMockItem[] {
  if (chip === 'all') return items
  if (chip === 'critical') return items.filter((i) => i.queueBucket === 'critical')
  if (chip === 'resolved') return items.filter((i) => i.queueBucket === 'solved')
  if (chip === 'escalated') return items.filter((i) => i.status === 'escalated')
  if (chip === 'ai_review') return items.filter((i) => i.status === 'ai_review')
  if (chip === 'my_action')
    return items.filter((i) => i.queueBucket !== 'solved' && i.status === 'assigned')
  return items
}

function SummaryBar({
  active,
  onSelect,
}: {
  active: SummaryFilterId
  onSelect: (id: SafetyQueueBucket) => void
}) {
  const items: Array<{
    id: SafetyQueueBucket
    label: string
    value: number
    tone: (typeof TONE)[keyof typeof TONE]
  }> = [
    { id: 'critical', label: HSE_SAFETY_ALERTS_COPY.summaryCritical, value: countByBucket('critical'), tone: TONE.critical },
    {
      id: 'needs_review',
      label: HSE_SAFETY_ALERTS_COPY.summaryNeedsReview,
      value: countByBucket('needs_review'),
      tone: TONE.needs_review,
    },
    { id: 'solved', label: HSE_SAFETY_ALERTS_COPY.summarySolved, value: countByBucket('solved'), tone: TONE.solved },
  ]

  return (
    <div
      className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
      role="group"
      aria-label={HSE_SAFETY_ALERTS_COPY.ariaSummary}
    >
      {items.map((item) => {
        const selected = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-all',
              selected ? item.tone.chipActive : item.tone.chip,
              'hover:shadow-md'
            )}
            aria-pressed={selected}
          >
            <span className="text-sm font-medium">{item.label}</span>
            <span className={cn('text-2xl font-bold tabular-nums', item.tone.value)}>
              {item.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function FilterChips({
  active,
  onSelect,
}: {
  active: FilterChipId
  onSelect: (id: FilterChipId) => void
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={HSE_SAFETY_ALERTS_COPY.ariaFilter}>
      {FILTER_CHIPS.map((chip) => {
        const selected = active === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(chip.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionsSidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {MOCK_NAV_ITEMS.map((item) => {
        const isActive = item.id === ACTIVE_NAV_ID
        return (
          <li key={item.id} className="relative">
            <button
              type="button"
              onClick={onItemClick}
              className={cn(
                'relative flex w-full items-center rounded-lg px-3 py-2.5 text-right text-sm font-medium transition-colors',
                isActive
                  ? cn(SITE_NAVY, 'text-white shadow-sm')
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <span className="truncate pe-1">{item.label}</span>
            </button>
            {isActive && item.badge != null ? (
              <span
                className="absolute -top-1.5 end-0 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white"
                title={openSafetyAlertsTitle(item.badge)}
                aria-label={openSafetyAlertsTitle(item.badge)}
              >
                {item.badge}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function SectionsSidebar() {
  return (
    <nav
      aria-label={HSE_SAFETY_ALERTS_COPY.ariaSections}
      className="hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:block lg:sticky lg:top-4"
    >
      <p className="mb-2 px-2 text-[11px] font-semibold text-slate-500">{HSE_SAFETY_ALERTS_COPY.sectionsList}</p>
      <SectionsSidebarNav />
    </nav>
  )
}

function MobileSectionsDrawer() {
  const [open, setOpen] = useState(false)
  const activeItem = MOCK_NAV_ITEMS.find((i) => i.id === ACTIVE_NAV_ID)

  return (
    <div className="mb-4 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm"
      >
        <span className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-slate-500" />
          <span>{HSE_SAFETY_ALERTS_COPY.sectionsList}</span>
          {activeItem ? <span className="text-slate-500">· {activeItem.label}</span> : null}
        </span>
        {activeItem?.badge != null ? (
          <span
            className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white"
            title={openSafetyAlertsTitle(activeItem.badge)}
            aria-label={openSafetyAlertsTitle(activeItem.badge)}
          >
            {activeItem.badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label={HSE_SAFETY_ALERTS_COPY.closeMenu}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed end-0 top-0 z-50 flex h-full w-[min(280px,88vw)] flex-col border-s border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={HSE_SAFETY_ALERTS_COPY.ariaSections}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{HSE_SAFETY_ALERTS_COPY.sectionsList}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label={HSE_SAFETY_ALERTS_COPY.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <SectionsSidebarNav onItemClick={() => setOpen(false)} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function SoftSeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SOFT_SEVERITY[severity]
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function SoftStatusBadge({ status }: { status: IncidentStatus }) {
  const cfg = SOFT_STATUS[status] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  }
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function IncidentThumbnail({
  hasVideo,
  className,
}: {
  hasVideo: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-inner',
        className ?? 'h-[100px] w-[100px]'
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Video className="h-8 w-8 text-white/70" />
      </div>
      {hasVideo ? (
        <span className="absolute bottom-2 end-2 rounded-full bg-black/55 p-1.5 text-white">
          <Play className="h-3.5 w-3.5 fill-white" />
        </span>
      ) : null}
    </div>
  )
}

function cardBorderTone(item: SafetyAlertMockItem): string {
  if (item.queueBucket === 'solved') return TONE.solved.border
  if (item.queueBucket === 'critical') return TONE.critical.border
  if (item.queueBucket === 'needs_review') return TONE.needs_review.border
  return 'border-r-slate-300'
}

/** کارت حادثه */
export function IncidentCard({
  item,
  returnTo,
}: {
  item: SafetyAlertMockItem
  returnTo?: string
}) {
  const isStale = item.minutesAgo > 60

  return (
    <article
      className={cn(
        'relative rounded-xl border border-slate-200 border-r-4 bg-white p-4 shadow-sm',
        cardBorderTone(item)
      )}
    >
      <p
        className={cn(
          'absolute top-3 end-3 flex items-center gap-1 text-[11px] font-medium',
          isStale ? 'text-rose-600' : 'text-slate-500'
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        {formatMinutesAgoFa(item.minutesAgo)}
      </p>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:gap-4">
        <IncidentThumbnail
          hasVideo={item.hasVideo}
          className="h-[120px] w-full sm:h-[100px] sm:w-[100px]"
        />

        <div className="min-w-0 flex-1 space-y-2 pe-0 sm:pe-16">
          <div className="flex flex-wrap items-center gap-2">
            <SoftSeverityBadge severity={item.severity} />
            <SoftStatusBadge status={item.status} />
            <span className="font-mono text-[11px] text-slate-400">{item.code}</span>
          </div>

          <h3 className="text-lg font-bold leading-snug text-slate-900">{item.title}</h3>

          <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">{item.description}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            {item.breadcrumb.map((part, i) => (
              <span key={`${item.id}-${part}`} className="flex items-center gap-2">
                {i > 0 ? <span className="text-slate-300">·</span> : null}
                <span>{part}</span>
              </span>
            ))}
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
              {formatDateTime(item.detectedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors',
            TONE.critical.action
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {HSE_SAFETY_ALERTS_COPY.confirmFieldAction}
        </button>
        <Link
          href={incidentDetailHref(item.id, returnTo)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
        >
          {HSE_SAFETY_ALERTS_COPY.viewDetails}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}

type SafetyAlertsPageProps = {
  showSidebar?: boolean
  /** داخل داشبورد سرپرست — بدون هدر تکراری و پس‌زمینه تمام‌صفحه */
  embedded?: boolean
  className?: string
  onQueueChange?: (openCount: number) => void
}

function SafetyAlertsContent({
  showSidebar = true,
  embedded = false,
  className,
  onQueueChange,
}: SafetyAlertsPageProps) {
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilterId>('critical')
  const [chipFilter, setChipFilter] = useState<FilterChipId>('all')

  const filteredItems = useMemo(() => {
    const items = MOCK_SAFETY_ALERTS.filter((i) => i.queueBucket === summaryFilter)
    return filterByChip(items, chipFilter)
  }, [summaryFilter, chipFilter])

  useEffect(() => {
    onQueueChange?.(countOpenSafetyAlertMocks())
  }, [onQueueChange])

  function handleSummarySelect(id: SafetyQueueBucket) {
    setSummaryFilter(id)
    setChipFilter('all')
  }

  return (
    <div className={cn(embedded ? 'space-y-4' : 'space-y-5', className)} dir="rtl" lang="fa">
      {!embedded ? (
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f]">{HSE_SAFETY_ALERTS_COPY.pageTitle}</h1>
          <p className="text-sm text-slate-500">{HSE_SAFETY_ALERTS_COPY.pageSubtitle}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            {HSE_SAFETY_ALERTS_COPY.pageHint}
          </p>
        </header>
      ) : (
        <p className="text-xs leading-relaxed text-slate-600">
          {HSE_SAFETY_ALERTS_COPY.embeddedHint}
        </p>
      )}

      <SummaryBar active={summaryFilter} onSelect={handleSummarySelect} />
      <FilterChips active={chipFilter} onSelect={setChipFilter} />

      {showSidebar ? <MobileSectionsDrawer /> : null}

      <div
        className={cn(
          'grid gap-4',
          showSidebar && 'lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start'
        )}
      >
        <main className="min-w-0">
          <div
            className={cn(
              embedded
                ? 'space-y-4'
                : 'rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5'
            )}
          >
            {filteredItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {HSE_SAFETY_ALERTS_COPY.empty}
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredItems.map((item) => (
                  <IncidentCard
                    key={item.id}
                    item={item}
                    returnTo={embedded ? SUPERVISOR_RETURN : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {showSidebar ? <SectionsSidebar /> : null}
      </div>
    </div>
  )
}

export function SafetyAlertsPage(props: SafetyAlertsPageProps) {
  const { embedded, className, ...rest } = props
  if (embedded) {
    return <SafetyAlertsContent embedded className={className} {...rest} />
  }
  return (
    <div
      className={cn('min-h-screen bg-slate-100 font-sans px-4 py-6 sm:px-6', className)}
      dir="rtl"
      lang="fa"
    >
      <SafetyAlertsContent {...rest} />
    </div>
  )
}

export default SafetyAlertsPage
