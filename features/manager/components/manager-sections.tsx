/**
 * @file features/manager/components/manager-sections.tsx
 * @purpose کامپوننت UI — داشبورد مدیر پروژه و KPI (manager-sections)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on shared/lib/utils, features/evm/lib/rag-status, features/calc-trace/components/calc-trace, features/manager/lib/format, features/manager/lib/alert-period, features/manager/lib/overview-types, features/manager/config
 */

'use client'

import Link from 'next/link'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
Activity,
AlertTriangle,
ArrowLeft,
BellRing,
Calculator,
CalendarClock,
Check,
CheckCircle2,
ChevronLeft,
CircleSlash,
ClipboardCheck,
ClipboardList,
DoorOpen,
FileDiff,
FileText,
HardHat,
OctagonAlert,
Package,
Plus,
ShieldAlert,
ShieldCheck,
Sparkles,
Clock3,
Truck,
Unplug,
Users,
Wallet,
Warehouse,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { DEFAULT_RAG_THRESHOLDS } from '@/features/evm/lib/rag-status'
import { CumulativeProgressSheet } from './cumulative-progress-sheet'
import { CalcTraceTrigger } from '@/features/calc-trace/components/calc-trace'
import {
compactToman,
compactTomanParts,
latinDigits,
faNumber,
faPercent,
jalaliDate,
relativeTimeFa,
} from '@/features/manager/lib/format'
import { newInPeriod } from '@/features/manager/lib/alert-period'
import type {
ManagerAlert,
ManagerAlertDomain,
ManagerDecisions,
ManagerEvmSummary,
ManagerInvoiceSummary,
ManagerOverview,
ManagerPeriod,
ManagerPulseKey,
ManagerPulseSource,
ManagerResources,
SectionResult,
} from '@/features/manager/lib/overview-types'
import { EmptyNote, LoadingRows, SectionBody, SectionCard, Spinner } from './manager-ui'
import { MANAGER_PUNCT, MANAGER_UI_NUMBERS, SECTIONS_COPY } from '@/features/manager/config'

/* -------------------------------------------------------------- Tones */

export type Tone = 'good' | 'warn' | 'critical' | 'none'

const TONE_STYLE: Record<Tone, { chip: string; dot: string; icon: ReactNode; label: string }> = {
  good: {
    chip: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/15',
    dot: 'bg-emerald-500 ring-4 ring-emerald-500/15',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
    label: SECTIONS_COPY.tone.good,
  },
  warn: {
    chip: 'bg-amber-500/10 text-amber-700 ring-amber-600/15',
    dot: 'bg-amber-500 ring-4 ring-amber-500/15',
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
    label: SECTIONS_COPY.tone.warn,
  },
  critical: {
    chip: 'bg-rose-500/10 text-rose-700 ring-rose-600/15',
    dot: 'bg-rose-500 ring-4 ring-rose-500/15',
    icon: <OctagonAlert className="h-3.5 w-3.5" aria-hidden />,
    label: SECTIONS_COPY.tone.critical,
  },
  none: {
    chip: 'bg-slate-500/10 text-slate-600 ring-slate-500/15',
    dot: 'bg-slate-300 ring-4 ring-slate-300/20',
    icon: <CircleSlash className="h-3.5 w-3.5" aria-hidden />,
    label: SECTIONS_COPY.tone.none,
  },
}

export function StatusTag({ tone, label, className }: { tone: Tone; label?: string; className?: string }) {
  const style = TONE_STYLE[tone]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 tabular-nums ring-1 ring-inset backdrop-blur-sm',
        style.chip,
        className
      )}
    >
      {style.icon}
      {label ?? style.label}
    </span>
  )
}

export function indexTone(value: number | null | undefined): Tone {
  if (value == null) return 'none'
  if (value < DEFAULT_RAG_THRESHOLDS.critical) return 'critical'
  if (value < DEFAULT_RAG_THRESHOLDS.onTrack) return 'warn'
  return 'good'
}

/* ------------------------------------------------------------- Links */

export interface ManagerHrefs {
  evm?: string
  scheduleIntel?: string
  attendance?: string
  inventory?: string
  quality?: string
  hse?: string
  finance?: string
  invoices?: string
  gantt?: string
  procurement?: string
  inbox: ((focusId?: string) => string) | null
}

export function domainHref(domain: ManagerAlertDomain, hrefs: ManagerHrefs): string | undefined {
  switch (domain) {
    case 'schedule':
      return hrefs.scheduleIntel ?? hrefs.evm
    case 'cost':
      return hrefs.finance ?? hrefs.evm
    case 'safety':
      return hrefs.hse
    case 'materials':
      return hrefs.inventory
    case 'quality':
      return hrefs.quality
  }
}

/* -------------------------------------------------------- Health bar */

type RingTone = Exclude<Tone, 'none'> | 'info'

export type PillarVisual =
  | { kind: 'gauge'; value: number | null; max: number; target: number }
  | { kind: 'ring'; center: string | null; unit?: string; segments: { value: number; tone: RingTone }[]; total: number }
  | { kind: 'empty' }

export interface PillarAction {
  kind: 'add' | 'details'
  label: string
  href?: string
}

export interface HealthPillar {
  key: string
  label: string
  tone: Tone
  subtitle: string
  visual: PillarVisual
  /** Colored one-line verdict under the visual. */
  status?: string
  action?: PillarAction
  href?: string
}

function stateMissing(result: SectionResult<unknown> | undefined, unavailable = SECTIONS_COPY.missing.notConnected): string {
  if (!result) return SECTIONS_COPY.missing.loading
  if (result.status === 'unavailable') return unavailable
  if (result.status === 'error') return SECTIONS_COPY.missing.loadError
  return ''
}

const details = (href: string | undefined): PillarAction => ({ kind: 'details', label: SECTIONS_COPY.details, href })

export function buildHealthPillars(overview: ManagerOverview | null, hrefs: ManagerHrefs): HealthPillar[] {
  const evm = overview?.evm.status === 'ok' ? overview.evm.data : null
  const inventory = overview?.site.inventory
  const quality = overview?.site.quality
  const hse = overview?.site.hse

  const schedule: HealthPillar = {
    key: 'schedule',
    label: SECTIONS_COPY.pillars.schedule,
    tone: indexTone(evm?.spi),
    subtitle: SECTIONS_COPY.pillars.scheduleSub,
    visual: { kind: 'gauge', value: evm?.spi ?? null, max: MANAGER_UI_NUMBERS.gaugeMax, target: 1 },
    status:
      evm?.spi != null
        ? SECTIONS_COPY.pillars.spiSpeed(faPercent(evm.spi * 100, 0))
        : evm
          ? SECTIONS_COPY.pillars.pvZero
          : stateMissing(overview?.evm),
    href: hrefs.evm,
  }

  const cost: HealthPillar = (() => {
    const base = { key: 'cost', label: SECTIONS_COPY.pillars.cost }
    if (!evm) {
      return { ...base, tone: 'none', subtitle: stateMissing(overview?.evm), visual: { kind: 'empty' }, action: details(hrefs.evm) }
    }
    if (evm.cpi == null) {
      return {
        ...base,
        tone: 'none',
        subtitle: SECTIONS_COPY.pillars.costMissing,
        visual: { kind: 'empty' },
        action: { kind: 'add', label: SECTIONS_COPY.addCost, href: hrefs.finance ?? hrefs.evm },
      }
    }
    const tone = indexTone(evm.cpi)
    return {
      ...base,
      tone,
      subtitle: SECTIONS_COPY.pillars.costSub,
      visual: {
        kind: 'ring',
        center: faNumber(evm.cpi, 2),
        unit: 'CPI',
        segments: [{ value: Math.min(evm.cpi, MANAGER_UI_NUMBERS.gaugeMax), tone: tone === 'none' ? 'good' : tone }],
        total: MANAGER_UI_NUMBERS.gaugeMax,
      },
      status: (() => {
        const parts = compactTomanParts(Math.abs(evm.cv))
        const amount = `${parts.value} ${parts.unit.replace(SECTIONS_COPY.tomanUnit, '')}`
        return evm.cv >= 0 ? SECTIONS_COPY.pillars.underBudget(amount) : SECTIONS_COPY.pillars.overBudget(amount)
      })(),
      action: details(hrefs.finance ?? hrefs.evm),
    }
  })()

  const safety: HealthPillar = (() => {
    const base = { key: 'hse', label: SECTIONS_COPY.pillars.hse }
    if (hse?.status !== 'ok') {
      return {
        ...base,
        tone: 'none',
        subtitle: stateMissing(hse, SECTIONS_COPY.pillars.hseMissing),
        visual: { kind: 'empty' },
        action: { kind: 'add', label: SECTIONS_COPY.connectData, href: hrefs.hse },
      }
    }
    const { critical, warning, info, windowDays, daysSinceSerious } = hse.data
    const total = critical + warning + info
    return {
      ...base,
      tone: critical > 0 ? 'critical' : warning > 0 ? 'warn' : 'good',
      subtitle: SECTIONS_COPY.pillars.hseWindow(faNumber(windowDays)),
      visual:
        total === 0
          ? { kind: 'ring', center: null, segments: [], total: 0 }
          : {
              kind: 'ring',
              center: faNumber(total),
              unit: SECTIONS_COPY.pillars.alertUnit,
              segments: [
                { value: critical, tone: 'critical' },
                { value: warning, tone: 'warn' },
                { value: info, tone: 'info' },
              ],
              total,
            },
      status:
        critical > 0
          ? SECTIONS_COPY.pillars.criticalAlerts(faNumber(critical))
          : daysSinceSerious != null
            ? SECTIONS_COPY.pillars.daysNoIncident(faNumber(daysSinceSerious))
            : SECTIONS_COPY.pillars.noSerious,
      action: details(hrefs.hse),
    }
  })()

  const qualityPillar: HealthPillar = (() => {
    const base = { key: 'quality', label: SECTIONS_COPY.pillars.quality }
    if (quality?.status !== 'ok') {
      return {
        ...base,
        tone: 'none',
        subtitle: stateMissing(quality),
        visual: { kind: 'empty' },
        action: { kind: 'add', label: SECTIONS_COPY.connectData, href: hrefs.quality },
      }
    }
    const { openNcrCount, criticalNcrCount } = quality.data
    return {
      ...base,
      tone: criticalNcrCount > 0 ? 'critical' : openNcrCount > 0 ? 'warn' : 'good',
      subtitle: SECTIONS_COPY.pillars.qualitySub,
      visual:
        openNcrCount === 0
          ? { kind: 'ring', center: null, segments: [], total: 0 }
          : {
              kind: 'ring',
              center: faNumber(openNcrCount),
              unit: SECTIONS_COPY.pillars.ncrOpenUnit,
              segments: [
                { value: criticalNcrCount, tone: 'critical' },
                { value: openNcrCount - criticalNcrCount, tone: 'warn' },
              ],
              total: openNcrCount,
            },
      status:
        openNcrCount === 0
          ? SECTIONS_COPY.pillars.noOpenNcr
          : criticalNcrCount > 0
            ? SECTIONS_COPY.pillars.criticalCount(faNumber(criticalNcrCount))
            : SECTIONS_COPY.pillars.noCritical,
      action: details(hrefs.quality),
    }
  })()

  const materials: HealthPillar = (() => {
    const base = { key: 'materials', label: SECTIONS_COPY.pillars.materials }
    if (inventory?.status !== 'ok') {
      return {
        ...base,
        tone: 'none',
        subtitle: stateMissing(inventory, SECTIONS_COPY.pillars.inventoryMissing),
        visual: { kind: 'empty' },
        action: { kind: 'add', label: SECTIONS_COPY.connectData, href: hrefs.inventory },
      }
    }
    const tracked = inventory.data.trackedCount
    const low = inventory.data.lowStock.length
    const empty = inventory.data.lowStock.filter((i) => i.current <= 0).length
    return {
      ...base,
      tone: empty > 0 ? 'critical' : low > 0 ? 'warn' : 'good',
      subtitle: SECTIONS_COPY.pillars.trackedItems(faNumber(tracked)),
      visual:
        low === 0
          ? { kind: 'ring', center: null, segments: [], total: 0 }
          : {
              kind: 'ring',
              center: faNumber(low),
              unit: SECTIONS_COPY.pillars.shortageUnit,
              segments: [
                { value: empty, tone: 'critical' },
                { value: low - empty, tone: 'warn' },
                { value: tracked - low, tone: 'good' },
              ],
              total: tracked,
            },
      status: low === 0 ? SECTIONS_COPY.pillars.noShortage : empty > 0 ? SECTIONS_COPY.pillars.emptyItems(faNumber(empty)) : SECTIONS_COPY.pillars.belowMin,
      action: details(hrefs.inventory),
    }
  })()

  return [schedule, cost, safety, qualityPillar, materials]
}

export function overallStatus(pillars: HealthPillar[]): { tone: Tone; label: string } {
  if (pillars.some((p) => p.tone === 'critical')) return { tone: 'critical', label: SECTIONS_COPY.tone.critical }
  if (pillars.some((p) => p.tone === 'warn')) return { tone: 'warn', label: SECTIONS_COPY.tone.warn }
  if (pillars.some((p) => p.tone === 'good')) return { tone: 'good', label: SECTIONS_COPY.tone.good }
  return { tone: 'none', label: SECTIONS_COPY.tone.none }
}

const PILLAR_TONE: Record<Tone, { card: string; color: string; text: string; badge: string }> = {
  good: { card: 'from-emerald-50/70', color: '#10b981', text: 'text-emerald-600', badge: SECTIONS_COPY.badge.good },
  warn: { card: 'from-amber-50/80', color: '#f59e0b', text: 'text-amber-600', badge: SECTIONS_COPY.badge.warn },
  critical: { card: 'from-rose-50/90', color: '#f43f5e', text: 'text-rose-600', badge: SECTIONS_COPY.badge.critical },
  none: { card: 'from-white', color: '#cbd5e1', text: 'text-slate-400', badge: SECTIONS_COPY.badge.none },
}

const RING_COLORS: Record<RingTone, string> = {
  good: '#10b981',
  warn: '#f59e0b',
  critical: '#f43f5e',
  info: '#38bdf8',
}

function SemiGauge({ value, max, target, tone }: { value: number | null; max: number; target: number; tone: Tone }) {
  const cx = 100
  const cy = 100
  const r = 78
  const stroke = 5
  const point = (fraction: number, radius = r) => {
    const angle = Math.PI * (1 - Math.min(Math.max(fraction, 0), 1))
    return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
  }
  const start = point(0)
  const end = point(1)
  const valueEnd = value != null && value > 0 ? point(value / max) : null
  const tickIn = point(target / max, r - 12)
  const tickOut = point(target / max, r + 12)
  const color = PILLAR_TONE[tone].color

  return (
    <div className="relative h-10 w-16">
      <svg viewBox="0 0 200 118" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <path
          d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {valueEnd ? (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${valueEnd.x} ${valueEnd.y}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ) : null}
        <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="#475569" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[11px] font-medium tabular-nums leading-none"
        style={{ color: value != null ? color : '#94a3b8' }}
      >
        {value != null ? faNumber(value, 2) : '—'}
      </span>
    </div>
  )
}

function Ring({ visual, tone }: { visual: Exclude<PillarVisual, { kind: 'gauge' }>; tone: Tone }) {
  const r = 48
  const stroke = 4.5
  const c = 2 * Math.PI * r
  const color = PILLAR_TONE[tone].color
  if (visual.kind === 'empty') {
    return (
      <svg viewBox="0 0 120 120" className="block h-12 w-12" aria-hidden>
        <circle cx={60} cy={60} r={r} fill="none" stroke="#d6d3d1" strokeWidth={4} strokeDasharray="5 12.3" strokeLinecap="round" />
        <line x1={52} y1={60} x2={68} y2={60} stroke="#a8a29e" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    )
  }
  if (visual.center == null) {
    return (
      <svg viewBox="0 0 120 120" className="block h-12 w-12" aria-hidden>
        <circle cx={60} cy={60} r={r} fill="none" stroke={color} strokeWidth={stroke} />
        <circle cx={60} cy={60} r={3} fill="white" stroke={color} strokeWidth={1.4} />
      </svg>
    )
  }
  let offset = 0
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-12 w-12" aria-hidden>
        <circle cx={60} cy={60} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <g transform="rotate(-90 60 60)">
          {visual.segments.map((segment, index) => {
            if (segment.value <= 0 || visual.total <= 0) return null
            const length = (segment.value / visual.total) * c
            const dash = (
              <circle
                key={index}
                cx={60}
                cy={60}
                r={r}
                fill="none"
                stroke={RING_COLORS[segment.tone]}
                strokeWidth={stroke}
                strokeDasharray={`${length} ${c - length}`}
                strokeDashoffset={-offset}
              />
            )
            offset += length
            return dash
          })}
        </g>
      </svg>
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums leading-none"
        style={{ color }}
      >
        {visual.center}
      </span>
    </div>
  )
}

function PillarCard({ pillar, loading }: { pillar: HealthPillar; loading: boolean }) {
  const style = PILLAR_TONE[pillar.tone]
  const { visual, action } = pillar
  const body = (
    <>
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1">
        {visual.kind === 'gauge' ? (
          <SemiGauge value={visual.value} max={visual.max} target={visual.target} tone={pillar.tone} />
        ) : (
          <Ring visual={visual} tone={pillar.tone} />
        )}
        <span
          className={cn(
            'inline-flex max-w-full items-center whitespace-nowrap rounded-full px-1.5 text-[10px] font-medium leading-4 ring-1 ring-inset',
            TONE_STYLE[pillar.tone].chip,
            loading && 'animate-pulse'
          )}
        >
          {style.badge}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="text-[12px] font-medium leading-4 text-slate-800">{pillar.label}</p>
        <p className="text-[10.5px] leading-4 text-slate-500">{pillar.subtitle}</p>
        {pillar.status || action?.href ? (
          <div className="mt-0.5 flex items-center gap-2 text-[10.5px] leading-4">
            {pillar.status ? (
              <span className={cn('min-w-0 font-medium', style.text)}>{pillar.status}</span>
            ) : (
              <span className="min-w-0 flex-1" />
            )}
            {action?.href ? (
              <Link
                href={action.href}
                aria-label={action.label}
                title={action.label}
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  action.kind === 'add' ? 'text-orange-600 hover:text-orange-700' : 'text-orange-500 hover:text-orange-700'
                )}
              >
                {action.kind === 'add' ? (
                  <>
                    {action.label}
                    <Plus className="h-3 w-3" aria-hidden />
                  </>
                ) : (
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                )}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
  const cls = cn(
    'flex h-full items-center gap-2.5 rounded-xl border border-[#1e2a5e]/45 bg-gradient-to-br via-white to-white px-3 py-2.5 shadow-xs transition-all duration-200',
    style.card
  )
  return !action && pillar.href ? (
    <Link
      href={pillar.href}
      className={cn(cls, 'hover:-translate-y-px hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:hover:translate-y-0')}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(cls, 'hover:shadow-soft')}>{body}</div>
  )
}

export function HealthBar({ pillars, loading }: { pillars: HealthPillar[]; loading: boolean }) {
  return (
    <div data-tour="health" className="border-t border-sky-200/60">
      <ul
        aria-label={SECTIONS_COPY.healthAria}
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 [scrollbar-width:thin] sm:px-5 lg:px-7 2xl:grid 2xl:grid-cols-5 2xl:overflow-visible"
      >
        {pillars.map((pillar) => (
          <li key={pillar.key} title={`${pillar.label}: ${pillar.subtitle}`} className="w-[268px] shrink-0 2xl:w-auto">
            <PillarCard pillar={pillar} loading={loading} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------- KPIs */

function KpiCard({
  title,
  tag,
  href,
  hint,
  action,
  children,
}: {
  title: string
  tag?: ReactNode
  href?: string
  hint: string
  /** Interactive control next to the title; the card link then becomes an overlay so the control is not nested in it. */
  action?: ReactNode
  children: ReactNode
}) {
  const base =
    'group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
  const body = (
    <>
      <div className="flex min-h-[26px] items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-[12px] font-medium leading-5 text-slate-800">
          {title}
          {action ? <span className="pointer-events-auto relative z-10">{action}</span> : null}
        </p>
        {tag}
      </div>
      {children}
    </>
  )
  if (href && action) {
    return (
      <div
        title={hint}
        className={cn(base, 'relative focus-within:ring-2 focus-within:ring-primary/60 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md motion-reduce:hover:translate-y-0')}
      >
        <Link href={href} aria-label={title} className="absolute inset-0 rounded-2xl focus-visible:outline-none" />
        <div className="pointer-events-none relative flex flex-1 flex-col">{body}</div>
      </div>
    )
  }
  return href ? (
    <Link
      href={href}
      title={hint}
      className={cn(base, 'hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md motion-reduce:hover:translate-y-0')}
    >
      {body}
    </Link>
  ) : (
    <div title={hint} className={cn(base, 'hover:shadow-md')}>
      {body}
    </div>
  )
}

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  critical: 'text-rose-600',
  none: 'text-slate-900',
}

function BigValue({ value, unit, muted, className }: { value: string; unit?: string; muted?: boolean; className?: string }) {
  return (
    <p className="mt-4 flex items-baseline gap-1.5">
      <span
        className={cn(
          'text-xl font-medium leading-none tracking-tight tabular-nums text-slate-900 sm:text-[22px]',
          className,
          muted && 'text-slate-300'
        )}
      >
        {value}
      </span>
      {unit ? <span className="text-sm font-medium text-slate-400">{unit}</span> : null}
    </p>
  )
}

function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-2 text-xs leading-relaxed text-slate-500', className)}>{children}</p>
}

function ProgressVsPlan({ actual, planned }: { actual: number; planned: number }) {
  const a = Math.max(0, Math.min(100, actual))
  const p = Math.max(0, Math.min(100, planned))
  return (
    <div className="mt-4" aria-hidden>
      <div className="relative mx-1 h-4">
        <span
          className="absolute -top-4 translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium text-slate-700"
          style={{ right: `${p}%` }}
        >
          {SECTIONS_COPY.planMark}
        </span>
      </div>
      <div className="relative mx-1 h-2">
        <div className="absolute inset-0 rounded-full bg-slate-100" />
        <div className="absolute inset-y-0 right-0 rounded-full bg-orange-600" style={{ width: `${a}%` }} />
        <span
          className="absolute -top-1 h-[18px] w-[2px] translate-x-1/2 rounded-full bg-slate-800 ring-1 ring-white"
          style={{ right: `${p}%` }}
        />
      </div>
    </div>
  )
}

function LegendRow({ swatch, label, value }: { swatch: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex min-w-0 items-center gap-2 text-slate-700">
        <span className="flex w-3.5 shrink-0 justify-center">{swatch}</span>
        <span className="truncate">{label}</span>
      </dt>
      <dd className="shrink-0 font-medium tabular-nums text-slate-800">{value}</dd>
    </div>
  )
}

const DAY_MS = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / DAY_MS)
}

interface TimelineMarker {
  key: string
  label: string
  date: string
  shape: 'today' | 'forecast' | 'contract'
}

const TIMELINE_ROW_PX = 30
const TIMELINE_MIN_GAP = 32

function ScheduleTimeline({
  start,
  today,
  forecast,
  contract,
  color,
}: {
  start: string
  today: string
  forecast: string
  contract: string | null
  color: string
}) {
  const end = [today, forecast, contract].reduce<string>((max, d) => (d && d > max ? d : max), start)
  const span = Math.max(1, daysBetween(start, end))
  const pos = (d: string) => Math.max(0, Math.min(100, (daysBetween(start, d) / span) * 100))

  const markers: TimelineMarker[] = [
    { key: 'today', label: SECTIONS_COPY.timeline.today, date: today, shape: 'today' },
    { key: 'forecast', label: SECTIONS_COPY.timeline.forecast, date: forecast, shape: 'forecast' },
    ...(contract ? [{ key: 'contract', label: SECTIONS_COPY.timeline.contract, date: contract, shape: 'contract' as const }] : []),
  ]
  const rowEnds: number[] = []
  const placed = [...markers]
    .sort((a, b) => pos(a.date) - pos(b.date))
    .map((m) => {
      const p = pos(m.date)
      let row = rowEnds.findIndex((last) => p - last >= TIMELINE_MIN_GAP)
      if (row < 0) row = rowEnds.length
      rowEnds[row] = p
      return { ...m, p, row }
    })
  const todayPos = pos(today)
  const forecastPos = pos(forecast)

  return (
    <div className="mt-4" aria-hidden>
      <div className="relative mx-2 h-4">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-100" />
        <div
          className="absolute top-1/2 right-0 h-1 -translate-y-1/2 rounded-full"
          style={{ width: `${todayPos}%`, backgroundColor: color }}
        />
        {forecastPos > todayPos ? (
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 opacity-25"
            style={{ right: `${todayPos}%`, width: `${forecastPos - todayPos}%`, backgroundColor: color }}
          />
        ) : null}
        {placed.map((m) =>
          m.shape === 'today' ? (
            <span
              key={m.key}
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 bg-white"
              style={{ right: `${m.p}%`, borderColor: color }}
            />
          ) : m.shape === 'forecast' ? (
            <span
              key={m.key}
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rotate-45 rounded-[2px] bg-slate-800 ring-2 ring-white"
              style={{ right: `${m.p}%` }}
            />
          ) : (
            <span
              key={m.key}
              className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 translate-x-1/2 rounded-full bg-slate-800"
              style={{ right: `${m.p}%` }}
            />
          )
        )}
      </div>
      <div className="relative mx-2 mt-1.5" style={{ height: rowEnds.length * TIMELINE_ROW_PX }}>
        {placed.map((m) => (
          <div
            key={m.key}
            className={cn(
              'absolute whitespace-nowrap text-center leading-4',
              m.p < 12 ? 'translate-x-0 text-right' : m.p > 88 ? 'translate-x-full text-left' : 'translate-x-1/2'
            )}
            style={{ right: `${m.p}%`, top: m.row * TIMELINE_ROW_PX }}
          >
            <p className="text-[10.5px] font-medium" style={m.shape === 'today' ? { color } : undefined}>
              <span className={m.shape === 'today' ? undefined : 'text-slate-700'}>{m.label}</span>
            </p>
            <p className="text-[10px] tabular-nums text-slate-500">{jalaliDate(m.date)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CostGauge({ cpi, tone }: { cpi: number | null; tone: Tone }) {
  const cx = 100
  const cy = 100
  const r = 72
  const stroke = 5
  const max = 1.5
  const point = (fraction: number, radius = r) => {
    const angle = Math.PI * (1 - Math.min(Math.max(fraction, 0), 1))
    return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
  }
  const start = point(0)
  const end = point(1)
  const arc = (to: { x: number; y: number }) => `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${to.x} ${to.y}`
  const color = PILLAR_TONE[tone].color
  const tickIn = point(1 / max, r - 10)
  const tickOut = point(1 / max, r + 10)

  return (
    <div className="mt-3 flex justify-center" aria-hidden>
      <svg viewBox="0 0 200 118" className="block w-[150px]">
        {cpi == null ? (
          <path d={arc(end)} fill="none" stroke="#d6d3d1" strokeWidth={stroke} strokeDasharray="1 17" strokeLinecap="round" />
        ) : (
          <>
            <path d={arc(end)} fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" />
            {cpi > 0 ? <path d={arc(point(cpi / max))} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" /> : null}
            <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="#475569" strokeWidth={1.4} strokeLinecap="round" />
          </>
        )}
        {cpi == null ? (
          <line x1={88} y1={88} x2={112} y2={88} stroke="#a8a29e" strokeWidth={3} strokeLinecap="round" />
        ) : (
          <text x={cx} y={94} textAnchor="middle" fontSize={16} fontWeight={500} fill={color}>
            {faNumber(cpi, 2)}
          </text>
        )}
      </svg>
    </div>
  )
}

function CostTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-3 text-center',
        value == null ? 'border border-dashed border-slate-300 bg-slate-50/60' : 'bg-slate-50'
      )}
    >
      <span className={cn('text-sm font-semibold tabular-nums', value == null ? 'text-slate-300' : 'text-slate-800')}>
        {value ?? '—'}
      </span>
      <span className="max-w-full break-words text-[11px] leading-4 text-slate-500">{label}</span>
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
      {children}
    </span>
  )
}

export function KpiStrip({
  overview,
  loading,
  hrefs,
  inbox,
}: {
  overview: ManagerOverview | null
  loading: boolean
  hrefs: ManagerHrefs
  /** «اقدامات معوق و بحران‌ها» — the PM Inbox card. */
  inbox: ReactNode
}) {
  const [explainOpen, setExplainOpen] = useState(false)
  if (!overview && loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[172px] animate-pulse rounded-2xl border border-slate-200/70 bg-white motion-reduce:animate-none" />
        ))}
      </div>
    )
  }

  const evmResult = overview?.evm
  const evm: ManagerEvmSummary | null = evmResult?.status === 'ok' ? evmResult.data : null
  const missing = evmResult?.status === 'unavailable' ? evmResult.reason : evmResult?.status === 'error' ? evmResult.message : SECTIONS_COPY.missing.notConnected
  const actual = evm ? evm.actualPercent ?? evm.earnedPercent : null
  const gapPoints = evm ? evm.earnedPercent - evm.plannedPercent : null
  const spiTone = indexTone(evm?.spi)
  const cpiTone = indexTone(evm?.cpi)
  const costReady = evm != null && evm.budgetBasis !== 'none' && evm.ac > 0
  const forecast = evm?.scheduleForecast ?? null
  const contractEnd = overview?.project?.endDate?.slice(0, 10) ?? null
  const contractReserve = forecast && contractEnd ? daysBetween(forecast.forecastFinish, contractEnd) : null
  const projectId = overview?.project?.id ?? null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {explainOpen && projectId && overview ? (
        <CumulativeProgressSheet
          projectId={projectId}
          today={overview.site.date}
          card={{ planned: evm?.plannedPercent ?? null, actual }}
          onClose={() => setExplainOpen(false)}
        />
      ) : null}
      <KpiCard
        title={SECTIONS_COPY.cumulative.title}
        href={hrefs.evm}
        action={
          evm && projectId ? (
            <span className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setExplainOpen(true)}
                aria-label={SECTIONS_COPY.cumulative.formulaAria}
                title={SECTIONS_COPY.cumulative.formulaAria}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              >
                <Calculator className="h-4 w-4" aria-hidden />
              </button>
              <CalcTraceTrigger metrics={['home.progress_gap', 'home.pv_curve']} />
            </span>
          ) : undefined
        }
        hint={SECTIONS_COPY.cumulative.hint}
        tag={
          evm && actual != null ? (
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-inset ring-slate-500/15">
              {SECTIONS_COPY.cumulative.planChip(faPercent(evm.plannedPercent))}
            </span>
          ) : undefined
        }
      >
        {evm && actual != null ? (
          <>
            <p className="mt-1 text-xs text-slate-500">{SECTIONS_COPY.cumulative.vsWork}</p>
            <BigValue value={faPercent(actual)} unit={SECTIONS_COPY.cumulative.recorded} />
            <ProgressVsPlan actual={actual} planned={evm.plannedPercent} />
            <dl className="mt-4 space-y-2.5 text-xs">
              <LegendRow swatch={<span className="h-3 w-3 rounded-[3px] bg-orange-600" />} label={SECTIONS_COPY.cumulative.physical} value={faPercent(actual)} />
              <LegendRow swatch={<span className="h-3.5 w-[3px] rounded-full bg-slate-800" />} label={SECTIONS_COPY.cumulative.planToDate} value={faPercent(evm.plannedPercent)} />
              <LegendRow
                swatch={<span className="h-3 w-3 rounded-[3px] border-2 border-slate-400" />}
                label={SECTIONS_COPY.cumulative.evBudget}
                value={faPercent(evm.earnedPercent)}
              />
            </dl>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
              {(() => {
                const gap = actual - evm.plannedPercent
                const behind = gap < -0.05
                return (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                      behind ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    )}
                  >
                    {Math.abs(gap) < 0.05
                      ? SECTIONS_COPY.cumulative.onPlan
                      : SECTIONS_COPY.cumulative.gapVsPlan(faNumber(Math.abs(gap), 1), behind ? SECTIONS_COPY.cumulative.behind : SECTIONS_COPY.cumulative.ahead)}
                  </span>
                )
              })()}
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-600 group-hover:text-orange-700">
                {SECTIONS_COPY.details}
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
              </span>
            </div>
          </>
        ) : (
          <>
            <BigValue value="—" muted />
            <Meta>{missing}</Meta>
          </>
        )}
      </KpiCard>

      <KpiCard
        title={SECTIONS_COPY.scheduleVar.title}
        href={hrefs.evm}
        action={overview?.traces ? <CalcTraceTrigger metrics={['home.spi_t', 'home.sv']} /> : undefined}
        hint={SECTIONS_COPY.scheduleVar.hint}
        tag={evm?.spi != null ? <StatusTag tone={spiTone} label={`SPI ${faNumber(evm.spi, 2)}`} /> : undefined}
      >
        {evm && evm.spi != null ? (
          <>
            <p className="mt-1 text-xs text-slate-500">{SECTIONS_COPY.scheduleVar.forecastEnd}</p>
            {evm.scheduleVarianceDays != null ? (
              <BigValue
                className={TONE_TEXT[spiTone]}
                value={faNumber(Math.abs(evm.scheduleVarianceDays))}
                unit={evm.scheduleVarianceDays > 0 ? SECTIONS_COPY.scheduleVar.daysBehind : evm.scheduleVarianceDays < 0 ? SECTIONS_COPY.scheduleVar.daysAhead : SECTIONS_COPY.scheduleVar.onPlan}
              />
            ) : (
              <BigValue className={TONE_TEXT[spiTone]} value={faNumber(Math.abs(gapPoints ?? 0), 1)} unit={SECTIONS_COPY.scheduleVar.percentUnit} />
            )}
            {gapPoints != null ? (
              <Meta>
                <span className="font-semibold tabular-nums text-slate-700">{faNumber(Math.abs(gapPoints), 1)}</span>
                {SECTIONS_COPY.scheduleVar.gapLead}
                {gapPoints < 0 ? SECTIONS_COPY.scheduleVar.behind : SECTIONS_COPY.scheduleVar.ahead}{SECTIONS_COPY.scheduleVar.vsValuePlan}
              </Meta>
            ) : null}
            {forecast ? (
              <ScheduleTimeline
                start={forecast.start}
                today={evm.asOf}
                forecast={forecast.forecastFinish}
                contract={contractEnd}
                color={PILLAR_TONE[spiTone].color}
              />
            ) : null}
            <div className="mt-auto pt-3">
              {contractReserve != null ? (
                <p className={cn('text-xs font-bold', contractReserve >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                  {contractReserve > 0
                    ? SECTIONS_COPY.scheduleVar.reserve(faNumber(contractReserve))
                    : contractReserve < 0
                      ? SECTIONS_COPY.scheduleVar.delay(faNumber(-contractReserve))
                      : SECTIONS_COPY.scheduleVar.sameFinish}
                </p>
              ) : forecast ? (
                <p className="text-xs text-slate-500">{SECTIONS_COPY.scheduleVar.noContractDate}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Chip>SPI {faNumber(evm.spi, 2)}</Chip>
                  <Chip>EV {faPercent(evm.earnedPercent)}</Chip>
                  <Chip>PV {faPercent(evm.plannedPercent)}</Chip>
                </div>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-600 group-hover:text-orange-700">
                  {SECTIONS_COPY.details}
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <BigValue value="—" muted />
            <Meta>{evm ? SECTIONS_COPY.scheduleVar.spiUnavailable : missing}</Meta>
          </>
        )}
      </KpiCard>

      <KpiCard
        title={SECTIONS_COPY.costVar.title}
        action={overview?.traces ? <CalcTraceTrigger metrics={['home.cpi', 'home.cv', 'home.eac', 'home.etc']} /> : undefined}
        hint={SECTIONS_COPY.costVar.hint}
        tag={
          costReady && evm?.cpi != null ? (
            <StatusTag tone={cpiTone} label={`CPI ${faNumber(evm.cpi, 2)}`} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{SECTIONS_COPY.badge.none}</span>
          )
        }
      >
        {(() => {
          const subtitle = costReady
            ? evm.cv < 0
              ? SECTIONS_COPY.costVar.overSpent
              : SECTIONS_COPY.costVar.underSpent
            : evm
              ? evm.budgetBasis === 'none'
                ? SECTIONS_COPY.costVar.noBudget
                : SECTIONS_COPY.costVar.noActual
              : missing
          const eac = costReady && evm.cpi != null && evm.cpi > 0 ? evm.bac / evm.cpi : null
          const used = costReady && evm.bac > 0 ? (evm.ac / evm.bac) * 100 : null
          const money = (v: number) => {
            const parts = compactTomanParts(v)
            return `${parts.value} ${parts.unit.replace(SECTIONS_COPY.tomanUnit, '')}`.trim()
          }
          return (
            <>
              <p className={cn('mt-1 text-xs', costReady ? (evm.cv < 0 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-500')}>
                {subtitle}
              </p>
              <CostGauge cpi={costReady ? evm.cpi : null} tone={cpiTone} />
              {costReady ? (
                <p className="text-center text-xs text-slate-600">
                  {SECTIONS_COPY.costVar.cvLabel}{' '}
                  <span className={cn('font-bold tabular-nums', evm.cv < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {evm.cv < 0 ? '−' : '+'}
                    {money(Math.abs(evm.cv))}
                  </span>
                </p>
              ) : (
                <p className="text-center text-xs text-slate-500">{SECTIONS_COPY.costVar.pendingHint}</p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <CostTile label="CPI" value={costReady && evm.cpi != null ? faNumber(evm.cpi, 2) : null} />
                <CostTile label={SECTIONS_COPY.costVar.eac} value={eac != null ? money(eac) : null} />
                <CostTile label={SECTIONS_COPY.costVar.used} value={used != null ? faPercent(used) : null} />
              </div>
              <div className="mt-auto flex justify-end pt-4">
                {costReady ? (
                  <Link
                    href={hrefs.finance ?? hrefs.evm ?? '#'}
                    className="inline-flex items-center gap-0.5 rounded text-xs font-bold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    {SECTIONS_COPY.details}
                    <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                  </Link>
                ) : evm && evm.budgetBasis !== 'none' && (hrefs.finance ?? hrefs.evm) ? (
                  <Link
                    href={(hrefs.finance ?? hrefs.evm) as string}
                    className="inline-flex items-center gap-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {SECTIONS_COPY.addCost}
                  </Link>
                ) : evm && hrefs.evm ? (
                  <Link
                    href={hrefs.evm}
                    className="inline-flex items-center gap-0.5 rounded text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    {SECTIONS_COPY.costVar.defineBudget}
                    <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </>
          )
        })()}
      </KpiCard>

      {/* The inbox takes the row height of the KPI cards and scrolls inside, instead of stretching the row. */}
      <div className="relative sm:min-h-[340px]">
        <div className="h-full sm:absolute sm:inset-0">{inbox}</div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Decisions */

function QuickApprove({
  packageId,
  onApproved,
}: {
  packageId: string
  onApproved: () => void
}) {
  const [stage, setStage] = useState<'idle' | 'confirm' | 'sending' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const approve = async () => {
    setStage('sending')
    setMessage(null)
    try {
      const response = await fetch(`/api/workshop/packages/${encodeURIComponent(packageId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: SECTIONS_COPY.decisions.approveComment }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || SECTIONS_COPY.decisions.approveFailed)
      onApproved()
    } catch (error) {
      setStage('error')
      setMessage(error instanceof Error ? error.message : SECTIONS_COPY.decisions.approveFailed)
    }
  }

  if (stage === 'confirm' || stage === 'sending') {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={stage === 'sending'}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          {stage === 'sending' ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" aria-hidden />}
          {SECTIONS_COPY.decisions.confirm}
        </button>
        <button
          type="button"
          onClick={() => setStage('idle')}
          disabled={stage === 'sending'}
          className="h-8 rounded-lg px-2 text-xs text-slate-600 hover:bg-slate-100"
        >
          {SECTIONS_COPY.decisions.cancel}
        </button>
      </span>
    )
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => setStage('confirm')}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200/80 bg-white px-2.5 text-xs font-semibold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        {SECTIONS_COPY.decisions.quickApprove}
      </button>
      {stage === 'error' && message ? <span role="alert" className="text-[11px] text-rose-700">{message}</span> : null}
    </span>
  )
}

export function DecisionsSection({
  result,
  loading,
  inboxHref,
  onChanged,
  className,
}: {
  result: SectionResult<ManagerDecisions> | undefined
  loading: boolean
  inboxHref: ((focusId?: string) => string) | null
  onChanged: () => void
  className?: string
}) {
  const [approved, setApproved] = useState<Set<string>>(new Set())
  useEffect(() => setApproved(new Set()), [result])

  const open = result?.status === 'ok' ? Math.max(0, result.data.total - approved.size) : null

  if (open === 0) {
    return (
      <section
        data-tour="decisions"
        aria-label={SECTIONS_COPY.decisions.title}
        className={cn(
          'flex items-center gap-3.5 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 bg-gradient-to-l from-emerald-50 via-emerald-50/60 to-white px-5 py-4 shadow-sm',
          className
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-xs ring-1 ring-emerald-200/70">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-900">{SECTIONS_COPY.decisions.title}</p>
          <p className="text-xs leading-relaxed text-emerald-700">{SECTIONS_COPY.decisions.empty}</p>
        </div>
      </section>
    )
  }

  return (
    <SectionCard
      tourId="decisions"
      className={className}
      title={SECTIONS_COPY.decisions.title}
      icon={<ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />}
      hint={SECTIONS_COPY.decisions.hint}
      action={
        open ? (
          <span className="rounded-full border border-orange-200/80 bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">
            {faNumber(open)}
          </span>
        ) : null
      }
    >
      <SectionBody result={result} loading={loading}>
        {(data) => {
          const items = [...data.items]
            .filter((i) => !approved.has(i.id))
            .sort((a, b) => {
              if (a.kind !== b.kind) return a.kind === 'change_request' ? -1 : 1
              return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
            })
          return (
            <div className="space-y-3">
              <ul className="space-y-2">
                {items.map((item) => {
                  const change = item.kind === 'change_request'
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 transition-colors hover:border-slate-300/70 hover:bg-slate-50/60"
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                          change ? 'border-amber-100 bg-amber-50 text-amber-600' : 'border-orange-100 bg-orange-50 text-primary'
                        )}
                        aria-hidden
                      >
                        {change ? <FileDiff className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-[11px] leading-5 text-slate-500">
                          <span className={change ? 'font-semibold text-amber-700' : 'font-semibold text-primary'}>
                            {change ? SECTIONS_COPY.decisions.changeRequest : SECTIONS_COPY.decisions.awaiting}
                          </span>
                          {item.subtitle ? <span className="truncate">{item.subtitle}</span> : null}
                          {item.updatedAt ? <span>{relativeTimeFa(item.updatedAt)}</span> : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {!change ? (
                          <QuickApprove
                            packageId={item.id}
                            onApproved={() => {
                              setApproved((prev) => new Set(prev).add(item.id))
                              onChanged()
                            }}
                          />
                        ) : null}
                        {inboxHref ? (
                          <Link
                            href={inboxHref(item.id)}
                            className="group/btn inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            {SECTIONS_COPY.decisions.review}
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/btn:-translate-x-0.5" aria-hidden />
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {inboxHref && open != null && open > items.length ? (
                <Link href={inboxHref()} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  {SECTIONS_COPY.decisions.viewAll(faNumber(open))}
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          )
        }}
      </SectionBody>
    </SectionCard>
  )
}

/* ------------------------------------------------------------ Alerts */

export const DOMAIN_META: Record<ManagerAlertDomain, { label: string; icon: ComponentType<{ className?: string }> }> = {
  schedule: { label: SECTIONS_COPY.domains.schedule, icon: CalendarClock },
  cost: { label: SECTIONS_COPY.domains.cost, icon: Wallet },
  safety: { label: SECTIONS_COPY.domains.safety, icon: HardHat },
  materials: { label: SECTIONS_COPY.domains.materials, icon: Package },
  quality: { label: SECTIONS_COPY.domains.quality, icon: ShieldCheck },
}

export function AlertCard({
  alert,
  period,
  href,
  expanded = false,
}: {
  alert: ManagerAlert
  period: ManagerPeriod
  href?: string
  expanded?: boolean
}) {
  const critical = alert.level === 'critical'
  const meta = DOMAIN_META[alert.domain]
  const Icon = meta.icon
  const fresh = newInPeriod(alert, period)
  const preview = expanded ? alert.items : alert.items.slice(0, MANAGER_UI_NUMBERS.alertsPreview)
  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-4 ps-5 shadow-xs transition-all duration-200 hover:border-slate-200 hover:shadow-md">
      <span
        aria-hidden
        className={cn('absolute inset-y-0 right-0 w-1', critical ? 'bg-rose-500' : 'bg-amber-400')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
            critical ? 'bg-rose-500/10 text-rose-700 ring-rose-600/15' : 'bg-amber-500/10 text-amber-700 ring-amber-600/15'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
        <span className="sr-only">{critical ? SECTIONS_COPY.alerts.levelCritical : SECTIONS_COPY.alerts.levelWarning}</span>
        <h3 className="min-w-0 flex-1 text-sm font-bold leading-6 text-slate-800">{alert.title}</h3>
        {alert.items.length > 1 ? (
          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
            {SECTIONS_COPY.alerts.itemCount(faNumber(alert.items.length))}
          </span>
        ) : null}
        {fresh > 0 ? (
          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
            {SECTIONS_COPY.alerts.fresh(faNumber(fresh))}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">{SECTIONS_COPY.alerts.impact}</span>
        {alert.impact}
      </p>
      {alert.items.length === 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{latinDigits(alert.cause)}</p>
      ) : null}
      {preview.length ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {preview.map((i) => i.label).join(MANAGER_PUNCT.list)}
          {!expanded && alert.items.length > preview.length ? SECTIONS_COPY.alerts.moreItems(faNumber(alert.items.length - preview.length)) : ''}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50/80 px-3 py-2">
        <p className="min-w-0 basis-full text-xs leading-relaxed text-slate-600 sm:basis-0 sm:flex-1">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-primary/80" aria-hidden />
            {SECTIONS_COPY.alerts.suggestion}
          </span>{' '}
          {alert.suggestion}
        </p>
        {href ? (
          <Link
            href={href}
            className={cn(
              'group/btn inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border bg-white px-3 text-xs font-semibold shadow-xs transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              critical
                ? 'border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50'
                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            {SECTIONS_COPY.alerts.act}
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/btn:-translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function SmartAlertsSection({
  result,
  loading,
  period,
  hrefs,
  className,
}: {
  result: SectionResult<ManagerAlert[]> | undefined
  loading: boolean
  period: ManagerPeriod
  hrefs: ManagerHrefs
  className?: string
}) {
  return (
    <SectionCard
      tourId="alerts"
      className={className}
      title={SECTIONS_COPY.alerts.title}
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      hint={SECTIONS_COPY.alerts.hint}
    >
      <SectionBody result={result} loading={loading} rows={3}>
        {(alerts) =>
          alerts.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {SECTIONS_COPY.alerts.none}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {alerts.slice(0, MANAGER_UI_NUMBERS.alertsPreview).map((alert) => (
                <AlertCard key={alert.id} alert={alert} period={period} href={domainHref(alert.domain, hrefs)} />
              ))}
              <Link
                href="/dashboard/manager/alerts"
                className="group/link mt-auto inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {alerts.length > 3
                  ? SECTIONS_COPY.alerts.viewAllMore(faNumber(alerts.length - MANAGER_UI_NUMBERS.alertsPreview))
                  : SECTIONS_COPY.alerts.viewAll}
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/link:-translate-x-0.5" aria-hidden />
              </Link>
            </div>
          )
        }
      </SectionBody>
    </SectionCard>
  )
}

/* -------------------------------------------------------- Site pulse */

const PULSE_ICONS: Record<ManagerPulseKey, ComponentType<{ className?: string }>> = {
  daily_report: ClipboardList,
  warehouse: Warehouse,
  hse: HardHat,
  gate: DoorOpen,
}

const PULSE_STATUS: Record<
  ManagerPulseSource['status'],
  { label: string; cls: string; icon: ComponentType<{ className?: string }> }
> = {
  fresh: { label: SECTIONS_COPY.pulse.fresh, cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/15', icon: CheckCircle2 },
  stale: { label: SECTIONS_COPY.pulse.stale, cls: 'bg-amber-500/10 text-amber-700 ring-amber-600/15', icon: Clock3 },
  never: { label: SECTIONS_COPY.pulse.never, cls: 'bg-amber-500/10 text-amber-700 ring-amber-600/15', icon: AlertTriangle },
  unavailable: { label: SECTIONS_COPY.pulse.unavailable, cls: 'bg-slate-500/10 text-slate-600 ring-slate-500/15', icon: Unplug },
}

function thresholdLabel(hours: number): string {
  return hours % 24 === 0 ? SECTIONS_COPY.pulse.days(faNumber(hours / 24)) : SECTIONS_COPY.pulse.hours(faNumber(hours))
}

function ReminderButton({
  source,
  projectId,
  onSent,
}: {
  source: ManagerPulseSource
  projectId: string | null
  onSent: () => void
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const send = async () => {
    if (!projectId) return
    setState('sending')
    setMessage(null)
    try {
      const response = await fetch('/api/manager/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, source: source.key }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || SECTIONS_COPY.pulse.remindFailed)
      const emailNote =
        body.email === 'sent'
          ? SECTIONS_COPY.pulse.emailSent
          : body.email === 'not_configured'
            ? SECTIONS_COPY.pulse.emailNotConfigured
            : body.email === 'failed'
              ? SECTIONS_COPY.pulse.emailFailed
              : SECTIONS_COPY.pulse.emailMissing
      setState('done')
      setMessage(SECTIONS_COPY.pulse.notified((body.recipients as string[]).join(MANAGER_PUNCT.list), emailNote))
      onSent()
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : SECTIONS_COPY.pulse.remindFailed)
    }
  }

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      {state !== 'done' ? (
        <button
          type="button"
          onClick={() => void send()}
          disabled={state === 'sending'}
          className="group/btn inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-all duration-200 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          {state === 'sending' ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <BellRing className="h-3.5 w-3.5 text-amber-500 transition-transform group-hover/btn:rotate-12" aria-hidden />
          )}
          {SECTIONS_COPY.pulse.sendRemind}
        </button>
      ) : null}
      {message ? (
        <p role="status" className={cn('text-[11px] leading-5', state === 'error' ? 'text-rose-700' : 'text-emerald-700')}>
          {message}
        </p>
      ) : null}
    </div>
  )
}

export function SitePulseSection({
  result,
  loading,
  projectId,
  onReminded,
  className,
}: {
  result: SectionResult<ManagerPulseSource[]> | undefined
  loading: boolean
  projectId: string | null
  onReminded: () => void
  className?: string
}) {
  return (
    <SectionCard
      tourId="pulse"
      className={className}
      title={SECTIONS_COPY.pulse.title}
      icon={<Activity className="h-4 w-4" aria-hidden />}
      hint={SECTIONS_COPY.pulse.hint}
    >
      <SectionBody result={result} loading={loading} rows={4}>
        {(sources) => (
          <ul className="space-y-2">
            {sources.map((source) => {
              const Icon = PULSE_ICONS[source.key]
              const status = PULSE_STATUS[source.status]
              const StatusIcon = status.icon
              const person = source.responsible[0]
              return (
                <li
                  key={source.key}
                  className="flex gap-3.5 rounded-xl border border-slate-100 bg-slate-50/40 p-3 transition-colors duration-200 hover:border-slate-200 hover:bg-white"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      source.status === 'fresh'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : source.status === 'unavailable'
                          ? 'bg-slate-500/10 text-slate-400'
                          : 'bg-amber-500/10 text-amber-600'
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-800">{source.label}</p>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                          status.cls
                        )}
                      >
                        <StatusIcon className="h-3 w-3" aria-hidden />
                        {status.label}
                      </span>
                    </div>
                    {source.status === 'unavailable' ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{SECTIONS_COPY.pulse.notConnectedDetail(source.reason)}</p>
                    ) : (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {source.lastActivityAt ? (
                          <>
                            {SECTIONS_COPY.pulse.lastRecord}<span className="font-semibold tabular-nums text-slate-800">{relativeTimeFa(source.lastActivityAt)}</span>
                            {source.detail ? ` · ${source.detail}` : ''}
                            {source.status === 'stale' ? SECTIONS_COPY.pulse.threshold(thresholdLabel(source.thresholdHours)) : ''}
                          </>
                        ) : (
                          source.reason
                        )}
                      </p>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {person ? (
                        <>
                          {source.roleLabel}: {source.responsible.map((p) => p.name).join(MANAGER_PUNCT.list)}
                          {' · '}
                          {person.lastSignInAt ? SECTIONS_COPY.pulse.lastSignIn(relativeTimeFa(person.lastSignInAt)) : SECTIONS_COPY.pulse.neverSignedIn}
                        </>
                      ) : (
                        SECTIONS_COPY.pulse.noOwner(source.roleLabel)
                      )}
                    </p>
                    {source.lastReminderAt ? (
                      <p className="text-[11px] leading-5 text-slate-400">{SECTIONS_COPY.pulse.lastReminder(relativeTimeFa(source.lastReminderAt))}</p>
                    ) : null}
                    {source.canRemind ? <ReminderButton source={source} projectId={projectId} onSent={onReminded} /> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionBody>
    </SectionCard>
  )
}

/* ------------------------------------------------ Resources & finance */

function Stat({ label, value, sub, muted }: { label: string; value: string; sub?: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
      <p className="text-[11px] font-medium leading-5 text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-2xl font-black leading-8 tracking-tight tabular-nums text-slate-900',
          muted && 'text-sm font-medium text-slate-400'
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-[11px] leading-5 text-slate-400">{sub}</p> : null}
    </div>
  )
}

function MissingNote({ result }: { result: SectionResult<unknown> }) {
  if (result.status === 'unavailable') return <EmptyNote title={SECTIONS_COPY.missing.notConnected} description={result.reason} />
  if (result.status === 'error') return <EmptyNote tone="error" title={SECTIONS_COPY.resources.loadFailed} description={result.message} />
  return null
}

export function ResourcesFinanceSection({
  resources,
  invoices,
  loading,
  hrefs,
  className,
}: {
  resources: SectionResult<ManagerResources> | undefined
  invoices: SectionResult<ManagerInvoiceSummary> | undefined
  loading: boolean
  hrefs: ManagerHrefs
  className?: string
}) {
  return (
    <SectionCard
      className={className}
      title={SECTIONS_COPY.resources.title}
      icon={<Users className="h-4 w-4" aria-hidden />}
      hint={SECTIONS_COPY.resources.hint}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
              <Users className="h-4 w-4 text-slate-400" aria-hidden />
              {SECTIONS_COPY.resources.present}
            </p>
            {hrefs.attendance ? (
              <Link href={hrefs.attendance} className="text-[11px] font-semibold text-primary hover:underline">
                {SECTIONS_COPY.resources.attendance}
              </Link>
            ) : null}
          </div>
          {!resources ? (
            loading ? <LoadingRows rows={2} /> : null
          ) : resources.status !== 'ok' ? (
            <MissingNote result={resources} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={SECTIONS_COPY.resources.presentToday} value={faNumber(resources.data.presentToday)} sub={SECTIONS_COPY.resources.insideNow(faNumber(resources.data.insideNow))} />
              <Stat label={SECTIONS_COPY.resources.workers} value={faNumber(resources.data.workers)} />
              <Stat label={SECTIONS_COPY.resources.technical} value={faNumber(resources.data.technical)} sub={resources.data.other ? SECTIONS_COPY.resources.other(faNumber(resources.data.other)) : undefined} />
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] leading-5 text-slate-500">
                  <Truck className="h-3.5 w-3.5" aria-hidden />
                  {SECTIONS_COPY.resources.machines}
                </p>
                <p className="text-[11px] leading-5 text-slate-400">{SECTIONS_COPY.resources.notConnected}</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
              {SECTIONS_COPY.resources.invoices}
            </p>
            {hrefs.invoices ? (
              <Link href={hrefs.invoices} className="text-[11px] font-semibold text-primary hover:underline">
                {SECTIONS_COPY.resources.invoicesPage}
              </Link>
            ) : null}
          </div>
          {!invoices ? (
            loading ? <LoadingRows rows={2} /> : null
          ) : invoices.status !== 'ok' ? (
            <MissingNote result={invoices} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={SECTIONS_COPY.resources.sent} value={compactToman(invoices.data.totalInvoiced).replace(SECTIONS_COPY.tomanUnit, '')} sub={SECTIONS_COPY.resources.invoiceCount(faNumber(invoices.data.count))} />
                <Stat
                  label={SECTIONS_COPY.resources.pending}
                  value={compactToman(invoices.data.pendingAmount).replace(SECTIONS_COPY.tomanUnit, '')}
                  sub={SECTIONS_COPY.resources.count(faNumber(invoices.data.pendingCount))}
                />
                <Stat
                  label={SECTIONS_COPY.resources.approvedUnpaid}
                  value={compactToman(invoices.data.approvedUnpaidAmount).replace(SECTIONS_COPY.tomanUnit, '')}
                  sub={SECTIONS_COPY.resources.count(faNumber(invoices.data.approvedUnpaidCount))}
                />
                <Stat label={SECTIONS_COPY.resources.received} value={compactToman(invoices.data.totalPaid).replace(SECTIONS_COPY.tomanUnit, '')} />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {SECTIONS_COPY.resources.rounded}
                {invoices.data.lastInvoiceDate ? SECTIONS_COPY.resources.lastInvoice(jalaliDate(invoices.data.lastInvoiceDate)) : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
