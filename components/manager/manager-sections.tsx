'use client'

import Link from 'next/link'
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileDiff,
  FileText,
  HardHat,
  OctagonAlert,
  Package,
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
import { cn } from '@/lib/utils'
import { DEFAULT_RAG_THRESHOLDS } from '@/lib/evm/ragStatus'
import {
  compactToman,
  compactTomanParts,
  faDigits,
  faNumber,
  faPercent,
  jalaliDate,
  relativeTimeFa,
} from '@/lib/manager/format'
import { newInPeriod } from '@/lib/manager/alert-period'
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
} from '@/lib/manager/overview-types'
import { EmptyNote, LoadingRows, SectionBody, SectionCard, Spinner } from './manager-ui'

/* -------------------------------------------------------------- Tones */

export type Tone = 'good' | 'warn' | 'critical' | 'none'

const TONE_STYLE: Record<Tone, { chip: string; dot: string; icon: ReactNode; label: string }> = {
  good: {
    chip: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/15',
    dot: 'bg-emerald-500 ring-4 ring-emerald-500/15',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
    label: 'پایدار',
  },
  warn: {
    chip: 'bg-amber-500/10 text-amber-700 ring-amber-600/15',
    dot: 'bg-amber-500 ring-4 ring-amber-500/15',
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
    label: 'نیازمند توجه',
  },
  critical: {
    chip: 'bg-rose-500/10 text-rose-700 ring-rose-600/15',
    dot: 'bg-rose-500 ring-4 ring-rose-500/15',
    icon: <OctagonAlert className="h-3.5 w-3.5" aria-hidden />,
    label: 'بحرانی',
  },
  none: {
    chip: 'bg-slate-500/10 text-slate-600 ring-slate-500/15',
    dot: 'bg-slate-300 ring-4 ring-slate-300/20',
    icon: <CircleSlash className="h-3.5 w-3.5" aria-hidden />,
    label: 'دادهٔ ناکافی',
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

export interface HealthPillar {
  key: string
  label: string
  tone: Tone
  value: string
  detail: string
  href?: string
}

function stateMissing(result: SectionResult<unknown> | undefined): string {
  if (!result) return 'در حال بارگذاری'
  if (result.status === 'unavailable') return 'داده هنوز متصل نشده'
  if (result.status === 'error') return 'خطا در بارگذاری'
  return ''
}

export function buildHealthPillars(overview: ManagerOverview | null, hrefs: ManagerHrefs): HealthPillar[] {
  const evm = overview?.evm.status === 'ok' ? overview.evm.data : null
  const inventory = overview?.site.inventory
  const quality = overview?.site.quality

  const materials: HealthPillar = (() => {
    if (inventory?.status !== 'ok') {
      return { key: 'materials', label: 'تأمین مصالح', tone: 'none', value: '—', detail: stateMissing(inventory), href: hrefs.inventory }
    }
    const empty = inventory.data.lowStock.filter((i) => i.current <= 0).length
    const low = inventory.data.lowStock.length
    return {
      key: 'materials',
      label: 'تأمین مصالح',
      tone: empty > 0 ? 'critical' : low > 0 ? 'warn' : 'good',
      value: low === 0 ? 'بدون کمبود' : `${faNumber(low)} قلم کمبود`,
      detail:
        low === 0
          ? `همهٔ ${faNumber(inventory.data.trackedCount)} قلم بالاتر از حداقل موجودی`
          : empty > 0
            ? `${faNumber(empty)} قلم تمام شده`
            : 'زیر حداقل موجودی',
      href: hrefs.inventory,
    }
  })()

  const qualityPillar: HealthPillar = (() => {
    if (quality?.status !== 'ok') {
      return { key: 'quality', label: 'کیفیت QA/QC', tone: 'none', value: '—', detail: stateMissing(quality), href: hrefs.quality }
    }
    const { openNcrCount, criticalNcrCount } = quality.data
    return {
      key: 'quality',
      label: 'کیفیت QA/QC',
      tone: criticalNcrCount > 0 ? 'critical' : openNcrCount > 0 ? 'warn' : 'good',
      value: openNcrCount === 0 ? 'بدون NCR باز' : `${faNumber(openNcrCount)} NCR باز`,
      detail: criticalNcrCount > 0 ? `${faNumber(criticalNcrCount)} مورد بحرانی` : 'عدم انطباق‌های باز',
      href: hrefs.quality,
    }
  })()

  return [
    {
      key: 'schedule',
      label: 'زمان‌بندی',
      tone: indexTone(evm?.spi),
      value: evm?.spi != null ? `SPI ${faNumber(evm.spi, 2)}` : '—',
      detail: evm ? (evm.spi != null ? 'شاخص عملکرد زمانی' : 'ارزش برنامه‌ای هنوز صفر است') : stateMissing(overview?.evm),
      href: hrefs.evm,
    },
    {
      key: 'cost',
      label: 'هزینه و بودجه',
      tone: indexTone(evm?.cpi),
      value: evm?.cpi != null ? `CPI ${faNumber(evm.cpi, 2)}` : '—',
      detail: evm ? (evm.cpi != null ? 'شاخص عملکرد هزینه' : 'هزینهٔ واقعی ثبت نشده') : stateMissing(overview?.evm),
      href: hrefs.evm,
    },
    {
      key: 'hse',
      label: 'ایمنی HSE',
      tone: 'none',
      value: '—',
      detail: 'داده هنوز متصل نشده',
      href: hrefs.hse,
    },
    qualityPillar,
    materials,
  ]
}

export function overallStatus(pillars: HealthPillar[]): { tone: Tone; label: string } {
  if (pillars.some((p) => p.tone === 'critical')) return { tone: 'critical', label: 'بحرانی' }
  if (pillars.some((p) => p.tone === 'warn')) return { tone: 'warn', label: 'نیازمند توجه' }
  if (pillars.some((p) => p.tone === 'good')) return { tone: 'good', label: 'پایدار' }
  return { tone: 'none', label: 'دادهٔ ناکافی' }
}

export function HealthBar({ pillars, loading }: { pillars: HealthPillar[]; loading: boolean }) {
  return (
    <div data-tour="health" className="border-t border-slate-100 bg-slate-50/60">
      <ul
        aria-label="نوار سلامت پروژه"
        className="flex snap-x gap-2.5 overflow-x-auto px-3 py-2.5 sm:px-5 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-7"
      >
        {pillars.map((pillar) => {
          const style = TONE_STYLE[pillar.tone]
          const content = (
            <>
              <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot, loading && 'animate-pulse')} aria-hidden />
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[11px] font-medium leading-4 text-slate-500">{pillar.label}</span>
                <span className="block truncate text-[13px] font-bold leading-5 tabular-nums text-slate-800">
                  <span className="sr-only">{style.label}: </span>
                  {pillar.value}
                </span>
              </span>
              <span className="ms-auto hidden truncate text-[11px] text-slate-400 2xl:inline">{pillar.detail}</span>
            </>
          )
          const cls =
            'flex min-w-[150px] snap-start items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 shadow-xs transition-all duration-200'
          return (
            <li key={pillar.key} title={`${pillar.label}: ${pillar.detail}`}>
              {pillar.href ? (
                <Link
                  href={pillar.href}
                  className={cn(cls, 'hover:-translate-y-px hover:border-slate-300/80 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:hover:translate-y-0')}
                >
                  {content}
                </Link>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          )
        })}
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
  children,
}: {
  title: string
  tag?: ReactNode
  href?: string
  hint: string
  children: ReactNode
}) {
  const base =
    'group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
  const body = (
    <>
      <div className="flex min-h-[26px] items-start justify-between gap-2">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {tag}
      </div>
      {children}
    </>
  )
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

function BigValue({ value, unit, muted }: { value: string; unit?: string; muted?: boolean }) {
  return (
    <p className="mt-4 flex items-baseline gap-1.5">
      <span
        className={cn(
          'text-2xl font-black leading-none tracking-tight tabular-nums text-slate-900 sm:text-[28px]',
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

function SubValues({ rows }: { rows: { k: string; label: string; value: string; unit?: string }[] }) {
  return (
    <dl className="mt-auto grid grid-cols-3 gap-1.5 pt-4">
      {rows.map((row) => (
        <div key={row.k} className="min-w-0 rounded-xl bg-slate-50 p-2.5" title={row.label}>
          <dt className="text-[10px] font-semibold leading-4 tracking-wide text-slate-400">
            <span dir="ltr">{row.k}</span>
            <span className="sr-only"> — {row.label}</span>
          </dt>
          <dd className="mt-1 whitespace-nowrap text-sm font-bold leading-5 tabular-nums text-slate-800">
            {row.value}
            {row.unit ? (
              <span
                className={cn(
                  'text-[10px] font-medium text-slate-400',
                  row.unit.length > 2 ? 'block leading-4' : 'ms-0.5'
                )}
              >
                {row.unit}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function DualProgress({ actual, planned }: { actual: number; planned: number }) {
  const a = Math.max(0, Math.min(100, actual))
  const p = Math.max(0, Math.min(100, planned))
  const behind = a + 0.5 < p
  return (
    <div className="mt-auto pt-4" aria-hidden>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className={cn(
            'absolute inset-y-0 right-0 rounded-full bg-gradient-to-l shadow-[inset_0_-1px_0_rgb(0_0_0/0.06)]',
            behind ? 'from-amber-300 to-amber-500' : 'from-emerald-300 to-emerald-500'
          )}
          style={{ width: `${a}%` }}
        />
        <div
          className="absolute -top-1 h-4 w-[3px] rounded-full bg-slate-700 ring-2 ring-white"
          style={{ right: `calc(${p}% - 1.5px)` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('h-1.5 w-3 rounded-full', behind ? 'bg-amber-400' : 'bg-emerald-400')} />
          واقعی تأییدشده
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[3px] rounded-full bg-slate-700" />
          برنامه تا امروز
        </span>
      </div>
    </div>
  )
}

export function KpiStrip({
  overview,
  loading,
  hrefs,
  criticalCount,
}: {
  overview: ManagerOverview | null
  loading: boolean
  hrefs: ManagerHrefs
  criticalCount: number | null
}) {
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
  const missing = evmResult?.status === 'unavailable' ? evmResult.reason : evmResult?.status === 'error' ? evmResult.message : 'داده هنوز متصل نشده'
  const actual = evm ? evm.actualPercent ?? evm.earnedPercent : null
  const gapPoints = evm ? evm.earnedPercent - evm.plannedPercent : null
  const decisions = overview?.decisions.status === 'ok' ? overview.decisions.data.total : null
  const pending = (decisions ?? 0) + (criticalCount ?? 0)
  const spiTone = indexTone(evm?.spi)
  const cpiTone = indexTone(evm?.cpi)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="پیشرفت تجمعی"
        href={hrefs.evm}
        hint="پیشرفت فیزیکی تأییدشده (وزنی) در برابر پیشرفت برنامه‌ای تا امروز؛ همان نقطهٔ امروز در نمودار S."
        tag={
          evm && actual != null ? (
            <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-inset ring-slate-500/15">
              برنامه {faPercent(evm.plannedPercent)}
            </span>
          ) : undefined
        }
      >
        {evm && actual != null ? (
          <>
            <BigValue value={faNumber(actual, 1)} unit="٪ تأییدشده" />
            <DualProgress actual={actual} planned={evm.plannedPercent} />
          </>
        ) : (
          <>
            <BigValue value="—" muted />
            <Meta>{missing}</Meta>
          </>
        )}
      </KpiCard>

      <KpiCard
        title="انحراف زمانی"
        href={hrefs.evm}
        hint="چند روز از برنامه عقب یا جلو هستیم (تاریخی که برنامه به پیشرفت کسب‌شدهٔ امروز می‌رسید) و شاخص SPI."
        tag={evm?.spi != null ? <StatusTag tone={spiTone} label={`SPI ${faNumber(evm.spi, 2)}`} /> : undefined}
      >
        {evm && evm.spi != null ? (
          <>
            {evm.scheduleVarianceDays != null ? (
              <BigValue
                value={faNumber(Math.abs(evm.scheduleVarianceDays))}
                unit={evm.scheduleVarianceDays > 0 ? 'روز عقب' : evm.scheduleVarianceDays < 0 ? 'روز جلو' : 'روز'}
              />
            ) : (
              <BigValue value={faNumber(Math.abs(gapPoints ?? 0), 1)} unit="واحد درصد" />
            )}
            {gapPoints != null ? (
              <Meta>
                <span className="font-semibold tabular-nums text-slate-700">{faNumber(Math.abs(gapPoints), 1)}</span> واحد درصد{' '}
                {gapPoints < 0 ? 'عقب‌تر' : 'جلوتر'} از برنامه (بر مبنای ارزش)
              </Meta>
            ) : null}
            <SubValues
              rows={[
                { k: 'PV', label: 'برنامه تا امروز', value: faNumber(evm.plannedPercent, evm.plannedPercent >= 99.95 ? 0 : 1), unit: '٪' },
                { k: 'EV', label: 'ارزش کسب‌شده', value: faNumber(evm.earnedPercent, evm.earnedPercent >= 99.95 ? 0 : 1), unit: '٪' },
                { k: 'SPI', label: 'شاخص', value: faNumber(evm.spi, 2) },
              ]}
            />
          </>
        ) : (
          <>
            <BigValue value="—" muted />
            <Meta>{evm ? 'ارزش برنامه‌ای هنوز صفر است؛ SPI قابل محاسبه نیست.' : missing}</Meta>
          </>
        )}
      </KpiCard>

      <KpiCard
        title="انحراف هزینه"
        href={hrefs.evm}
        hint="CV = EV − AC. منفی یعنی هزینهٔ واقعی بیشتر از ارزش کار انجام‌شده است."
        tag={evm?.cpi != null ? <StatusTag tone={cpiTone} label={`CPI ${faNumber(evm.cpi, 2)}`} /> : undefined}
      >
        {evm && evm.budgetBasis !== 'none' && evm.ac > 0 ? (
          <>
            <BigValue value={`${evm.cv < 0 ? '−' : '+'}${compactTomanParts(evm.cv).value}`} unit={compactTomanParts(evm.cv).unit} />
            <Meta className={evm.cv < 0 ? 'text-rose-600' : 'text-emerald-600'}>
              {evm.cv < 0 ? 'هزینهٔ واقعی بیش از ارزش کار انجام‌شده' : 'هزینهٔ واقعی کمتر از ارزش کار انجام‌شده'}
            </Meta>
            <SubValues
              rows={[
                { k: 'BAC', label: 'بودجه کل', v: evm.bac },
                { k: 'EV', label: 'ارزش کسب‌شده', v: evm.ev },
                { k: 'AC', label: 'هزینه واقعی', v: evm.ac },
              ].map((row) => ({
                k: row.k,
                label: row.label,
                value: compactTomanParts(row.v).value,
                unit: compactTomanParts(row.v).unit.replace(' تومان', ''),
              }))}
            />
          </>
        ) : (
          <>
            <BigValue value="—" muted />
            <Meta>
              {evm ? (evm.budgetBasis === 'none' ? 'بودجهٔ فعالیت‌ها ثبت نشده است.' : 'هزینهٔ واقعی ثبت نشده است.') : missing}
            </Meta>
          </>
        )}
      </KpiCard>

      <KpiCard
        title="اقدامات معوق و بحران‌ها"
        hint="تصمیم‌های باز در کارتابل شما به‌علاوهٔ هشدارهای فوری (قرمز)."
        tag={
          decisions != null || criticalCount != null ? (
            <StatusTag
              tone={(criticalCount ?? 0) > 0 ? 'critical' : pending > 0 ? 'warn' : 'good'}
              label={(criticalCount ?? 0) > 0 ? 'اقدام فوری' : pending > 0 ? 'در انتظار' : 'رسیدگی‌شده'}
            />
          ) : undefined
        }
      >
        {decisions != null || criticalCount != null ? (
          <>
            <BigValue value={faNumber(pending)} unit="مورد" />
            <div className="mt-auto flex flex-wrap gap-2 pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 font-medium tabular-nums text-slate-600 ring-1 ring-inset ring-slate-500/10">
                <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {decisions != null ? `${faNumber(decisions)} تصمیم باز` : 'کارتابل: —'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium tabular-nums ring-1 ring-inset',
                  (criticalCount ?? 0) > 0
                    ? 'bg-rose-500/10 text-rose-700 ring-rose-600/15'
                    : 'bg-slate-500/10 text-slate-600 ring-slate-500/10'
                )}
              >
                <OctagonAlert className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {criticalCount != null ? `${faNumber(criticalCount)} هشدار فوری` : 'هشدارها: —'}
              </span>
            </div>
          </>
        ) : (
          <BigValue value="—" muted />
        )}
      </KpiCard>
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
        body: JSON.stringify({ comment: 'تأیید سریع از داشبورد مدیر' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'تأیید ناموفق بود')
      onApproved()
    } catch (error) {
      setStage('error')
      setMessage(error instanceof Error ? error.message : 'تأیید ناموفق بود')
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
          تأیید نهایی
        </button>
        <button
          type="button"
          onClick={() => setStage('idle')}
          disabled={stage === 'sending'}
          className="h-8 rounded-lg px-2 text-xs text-slate-600 hover:bg-slate-100"
        >
          انصراف
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
        تأیید سریع
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
        aria-label="نیازمند تصمیم شما"
        className={cn(
          'flex items-center gap-3.5 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 bg-gradient-to-l from-emerald-50 via-emerald-50/60 to-white px-5 py-4 shadow-sm',
          className
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-xs ring-1 ring-emerald-200/70">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-emerald-900">نیازمند تصمیم شما</p>
          <p className="text-xs leading-relaxed text-emerald-700">همه درخواست‌ها رسیدگی شده است؛ موردی در انتظار تصمیم شما نیست.</p>
        </div>
      </section>
    )
  }

  return (
    <SectionCard
      tourId="decisions"
      className={className}
      title="نیازمند تصمیم شما"
      icon={<ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />}
      hint="بسته‌های کاری که دفتر فنی برای تأیید فرستاده یا برایشان درخواست تغییر ثبت شده، به ترتیب قدیمی‌ترین انتظار. «تأیید سریع» همان تأیید کارتابل است؛ برای جزئیات «بررسی» را بزنید."
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
                            {change ? 'درخواست تغییر' : 'منتظر تأیید'}
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
                            بررسی
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
                  مشاهدهٔ همهٔ {faNumber(open)} مورد در کارتابل
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
  schedule: { label: 'برنامه', icon: CalendarClock },
  cost: { label: 'هزینه', icon: Wallet },
  safety: { label: 'ایمنی', icon: HardHat },
  materials: { label: 'مصالح', icon: Package },
  quality: { label: 'کیفیت', icon: ShieldCheck },
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
  const preview = expanded ? alert.items : alert.items.slice(0, 3)
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
        <span className="sr-only">{critical ? 'سطح: بحرانی' : 'سطح: ریسک متوسط'}</span>
        <h3 className="min-w-0 flex-1 text-sm font-bold leading-6 text-slate-800">{alert.title}</h3>
        {alert.items.length > 1 ? (
          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
            {faNumber(alert.items.length)} مورد
          </span>
        ) : null}
        {fresh > 0 ? (
          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
            {faNumber(fresh)} تازه
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">اثر احتمالی: </span>
        {alert.impact}
      </p>
      {alert.items.length === 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{faDigits(alert.cause)}</p>
      ) : null}
      {preview.length ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {preview.map((i) => i.label).join('، ')}
          {!expanded && alert.items.length > preview.length ? ` و ${faNumber(alert.items.length - preview.length)} مورد دیگر` : ''}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50/80 px-3 py-2">
        <p className="min-w-0 basis-full text-xs leading-relaxed text-slate-600 sm:basis-0 sm:flex-1">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-primary/80" aria-hidden />
            پیشنهاد سیستم:
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
            اقدام و بررسی
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
      title="هشدارهای هوشمند"
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      hint="فقط سه هشدار با بالاترین اولویت. قرمز فقط برای بحران یا خطر توقف کارگاه است و کهربایی برای ریسک متوسط. هشدارهای مشابه (مثلاً چند فعالیت عقب‌افتاده) در یک کارت جمع شده‌اند. برچسب «تازه» یعنی در بازهٔ انتخابی سربرگ ثبت شده است."
    >
      <SectionBody result={result} loading={loading} rows={3}>
        {(alerts) =>
          alerts.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              هشدار فعالی وجود ندارد.
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {alerts.slice(0, 3).map((alert) => (
                <AlertCard key={alert.id} alert={alert} period={period} href={domainHref(alert.domain, hrefs)} />
              ))}
              <Link
                href="/dashboard/manager/alerts"
                className="group/link mt-auto inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {alerts.length > 3
                  ? `مشاهده همه هشدارها (${faNumber(alerts.length - 3)} مورد دیگر)`
                  : 'مشاهده همه هشدارها'}
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
  fresh: { label: 'به‌روز', cls: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/15', icon: CheckCircle2 },
  stale: { label: 'معوق', cls: 'bg-amber-500/10 text-amber-700 ring-amber-600/15', icon: Clock3 },
  never: { label: 'بدون ثبت', cls: 'bg-amber-500/10 text-amber-700 ring-amber-600/15', icon: AlertTriangle },
  unavailable: { label: 'متصل نشده', cls: 'bg-slate-500/10 text-slate-600 ring-slate-500/15', icon: Unplug },
}

function thresholdLabel(hours: number): string {
  return hours % 24 === 0 ? `${faNumber(hours / 24)} روز` : `${faNumber(hours)} ساعت`
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
      if (!response.ok) throw new Error(body.error || 'ارسال یادآوری ناموفق بود')
      const emailNote =
        body.email === 'sent'
          ? 'ایمیل هم ارسال شد.'
          : body.email === 'not_configured'
            ? 'ارسال ایمیل روی سرور پیکربندی نشده است.'
            : body.email === 'failed'
              ? 'ارسال ایمیل ناموفق بود.'
              : 'نشانی ایمیلی ثبت نشده است.'
      setState('done')
      setMessage(`اعلان برای ${(body.recipients as string[]).join('، ')} ثبت شد. ${emailNote}`)
      onSent()
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'ارسال یادآوری ناموفق بود')
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
          ارسال یادآوری
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
      title="نبض زنده کارگاه و انضباط ثبت اطلاعات"
      icon={<Activity className="h-4 w-4" aria-hidden />}
      hint="آخرین ثبت هر منبع اطلاعاتی و آخرین ورود مسئول آن به سامانه. اگر از آستانهٔ مجاز گذشته باشد برچسب «معوق» می‌گیرد و می‌توانید یادآوری بفرستید (اعلان داخلی و در صورت پیکربندی، ایمیل)."
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
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">داده هنوز متصل نشده — {source.reason}</p>
                    ) : (
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {source.lastActivityAt ? (
                          <>
                            آخرین ثبت: <span className="font-semibold tabular-nums text-slate-800">{relativeTimeFa(source.lastActivityAt)}</span>
                            {source.detail ? ` · ${source.detail}` : ''}
                            {source.status === 'stale' ? ` · آستانه ${thresholdLabel(source.thresholdHours)}` : ''}
                          </>
                        ) : (
                          source.reason
                        )}
                      </p>
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {person ? (
                        <>
                          {source.roleLabel}: {source.responsible.map((p) => p.name).join('، ')}
                          {' · '}
                          {person.lastSignInAt ? `آخرین ورود ${relativeTimeFa(person.lastSignInAt)}` : 'هنوز وارد سامانه نشده'}
                        </>
                      ) : (
                        `مسئول (${source.roleLabel}) در این پروژه تعریف نشده است`
                      )}
                    </p>
                    {source.lastReminderAt ? (
                      <p className="text-[11px] leading-5 text-slate-400">آخرین یادآوری: {relativeTimeFa(source.lastReminderAt)}</p>
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
  if (result.status === 'unavailable') return <EmptyNote title="داده هنوز متصل نشده" description={result.reason} />
  if (result.status === 'error') return <EmptyNote tone="error" title="بارگذاری ناموفق بود" description={result.message} />
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
      title="منابع و مالی امروز"
      icon={<Users className="h-4 w-4" aria-hidden />}
      hint="نفرات حاضر امروز طبق تردد گیت (به تفکیک سمت ثبت‌شده در پروژه) و وضعیت صورت‌وضعیت‌های ارسالی به کارفرما."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
              <Users className="h-4 w-4 text-slate-400" aria-hidden />
              منابع حاضر در کارگاه
            </p>
            {hrefs.attendance ? (
              <Link href={hrefs.attendance} className="text-[11px] font-semibold text-primary hover:underline">
                جزئیات تردد
              </Link>
            ) : null}
          </div>
          {!resources ? (
            loading ? <LoadingRows rows={2} /> : null
          ) : resources.status !== 'ok' ? (
            <MissingNote result={resources} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="حاضر امروز" value={faNumber(resources.data.presentToday)} sub={`${faNumber(resources.data.insideNow)} نفر اکنون داخل`} />
              <Stat label="نیروی کارگری" value={faNumber(resources.data.workers)} />
              <Stat label="کادر فنی" value={faNumber(resources.data.technical)} sub={resources.data.other ? `${faNumber(resources.data.other)} نفر سایر` : undefined} />
              <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] leading-5 text-slate-500">
                  <Truck className="h-3.5 w-3.5" aria-hidden />
                  ماشین‌آلات فعال
                </p>
                <p className="text-[11px] leading-5 text-slate-400">داده هنوز متصل نشده</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
              صورت‌وضعیت‌های کارفرما
            </p>
            {hrefs.invoices ? (
              <Link href={hrefs.invoices} className="text-[11px] font-semibold text-primary hover:underline">
                صفحهٔ صورت‌وضعیت‌ها
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
                <Stat label="ارسال‌شده به کارفرما" value={compactToman(invoices.data.totalInvoiced).replace(' تومان', '')} sub={`${faNumber(invoices.data.count)} صورت‌وضعیت`} />
                <Stat
                  label="در انتظار تأیید کارفرما"
                  value={compactToman(invoices.data.pendingAmount).replace(' تومان', '')}
                  sub={`${faNumber(invoices.data.pendingCount)} مورد`}
                />
                <Stat
                  label="تأییدشدهٔ پرداخت‌نشده"
                  value={compactToman(invoices.data.approvedUnpaidAmount).replace(' تومان', '')}
                  sub={`${faNumber(invoices.data.approvedUnpaidCount)} مورد`}
                />
                <Stat label="دریافت‌شده" value={compactToman(invoices.data.totalPaid).replace(' تومان', '')} />
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                مبالغ به تومان و گرد شده‌اند
                {invoices.data.lastInvoiceDate ? ` · آخرین صورت‌وضعیت: ${jalaliDate(invoices.data.lastInvoiceDate)}` : ''}
              </p>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
