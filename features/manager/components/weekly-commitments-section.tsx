/**
 * @file features/manager/components/weekly-commitments-section.tsx
 * @purpose کامپوننت UI — داشبورد مدیر پروژه و KPI (weekly-commitments-section)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on shared/lib/utils, features/manager/lib/format, features/manager/lib/overview-types, shared/types/project-controls, features/wwp/lib/policy, features/manager/lib/weekly-commitments, features/project-store/use-project-store, features/project-store/lib/overview-overlay, features/calc-trace/components/calc-trace, features/calc-trace/lib/types
 */

'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarCheck, CircleHelp, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import type { ManagerOverview } from '@/features/manager/lib/overview-types'
import type { ControlsSnapshot, ExplainedKpi } from '@/shared/types/project-controls'
import type { RootCauseCategory } from '@/features/wwp/lib/policy'
import {
indexHistoryFromCurve,
indexTone,
PPC_LOW,
ppcTone,
type PpcTone,
type WeeklyCommitmentsData,
type WeeklyCommitmentsResult,
} from '@/features/manager/lib/weekly-commitments'
import { useStoreWeeklyPpc } from '@/features/project-store/use-project-store'
import { withStorePpc } from '@/features/project-store/lib/overview-overlay'
import { LoadingRows, SectionCard } from './manager-ui'
import { MANAGER_PUNCT, WEEKLY_COPY } from '@/features/manager/config'
import { CalcTraceProvider, CalcTraceTrigger } from '@/features/calc-trace/components/calc-trace'
import type { CalcTraceMap } from '@/features/calc-trace/lib/types'
import {
CommitmentsHelp,
LocksHelp,
pct as pctDigits,
PpcHelp,
RncHelp,
SpiHelp,
SpiTHelp,
TrendHelp,
type HelpContext,
} from './weekly-commitments-help'

const TONE_COLOR: Record<PpcTone, string> = { good: '#12a06b', warn: '#f5a524', bad: '#e5484d' }
const TONE_CHIP: Record<PpcTone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
}
const PPC_LABEL: Record<PpcTone, string> = WEEKLY_COPY.ppcTone
const INDEX_LABEL: Record<PpcTone, string> = WEEKLY_COPY.indexTone

const CAUSE_COLOR: Record<RootCauseCategory, string> = {
  materials: '#e5484d',
  crew: '#f59e0b',
  equipment: '#8b5cf6',
  permit_approval: '#0ea5e9',
  design_info: '#14b8a6',
  prerequisite_work: '#6366f1',
  weather: '#64748b',
  site_access: '#a16207',
  payment: '#db2777',
  qc_rework: '#0f766e',
  other: '#a8a29e',
}

const CARD = 'rounded-2xl border border-[#1e2a5e]/45 bg-white px-5 py-4'

type Load<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string }
type ControlsBody = { snapshot: ControlsSnapshot; kpis: Record<string, ExplainedKpi> }

function useJson<T>(url: string | null, refreshKey: string | null): Load<T> {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' })
  useEffect(() => {
    if (!url) return
    let cancelled = false
    setLoad({ state: 'loading' })
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || body?.error) setLoad({ state: 'error', message: body?.error ?? WEEKLY_COPY.httpError(response.status) })
        else setLoad({ state: 'ok', data: body as T })
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ state: 'error', message: error instanceof Error ? error.message : WEEKLY_COPY.network })
      })
    return () => {
      cancelled = true
    }
  }, [url, refreshKey])
  return load
}

const pct = (v: number) => `${faNumber(Math.round(v))}${MANAGER_PUNCT.percent}`
const pctUpTo1 = (v: number) => pctDigits(v, 1)

function Chip({ tone, label }: { tone: PpcTone | 'none'; label: string }) {
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold',
        tone === 'none' ? 'bg-slate-100 text-slate-500' : TONE_CHIP[tone]
      )}
    >
      {label}
    </span>
  )
}

/** «؟» next to a card title; opens the full explanation of that card with its current numbers. */
function HelpButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={WEEKLY_COPY.helpAria(title)}
        title={WEEKLY_COPY.helpTitle}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#1e2a5e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
              <p className="text-base font-bold text-slate-800">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={WEEKLY_COPY.close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-[13px] leading-7 text-slate-700">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function CardTop({ title, sub, en, chip, help }: { title: string; sub?: string; en?: string; chip?: ReactNode; help?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {help ? <HelpButton title={title}>{help}</HelpButton> : null}
        </div>
        {en ? (
          <p className="mt-0.5 text-[10.5px] text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>
            {en}
          </p>
        ) : null}
        {sub ? <p className="mt-0.5 text-[11.5px] leading-6 text-slate-500">{sub}</p> : null}
      </div>
      {chip}
    </div>
  )
}

function Missing({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2.5 text-[11.5px] leading-6 text-slate-600">{text}</p>
}

const GHOST_STROKE = '#cbd5e1'

/** Hollow, faded preview of a chart or table that has no data yet, with the reason underneath. */
function Ghost({ reason, children }: { reason: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="relative select-none" aria-hidden>
        <div className="opacity-70">{children}</div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-dashed border-slate-300 bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-500">
          {WEEKLY_COPY.noDataOverlay}
        </span>
      </div>
      <p className="mt-2 text-[10.5px] leading-5 text-slate-400">{reason}</p>
    </div>
  )
}

function GhostValue() {
  return (
    <div className="mt-1">
      <p className="text-[22px] font-medium leading-none tabular-nums text-transparent" style={{ WebkitTextStroke: `1px ${GHOST_STROKE}` }}>
        {WEEKLY_COPY.ghostPct}
      </p>
      <div className="mt-3 space-y-2">
        <div className="h-2.5 w-4/5 rounded-full border border-dashed border-slate-300" />
        <div className="h-2.5 w-3/5 rounded-full border border-dashed border-slate-300" />
      </div>
    </div>
  )
}

function GhostPpcTrend({ target }: { target: number }) {
  const W = 560
  const H = 200
  const PL = 8
  const PR = 36
  const PT = 20
  const PB = 28
  const n = 8
  const slot = (W - PL - PR) / n
  const bw = slot * 0.6
  const x = (i: number) => W - PR - (i + 1) * slot + (slot - bw) / 2
  const y = (v: number) => PT + ((100 - v) / 100) * (H - PT - PB)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#eef2f6" />
          <text x={W - PR + 6} y={y(v) + 4} fontSize={10} fill={GHOST_STROKE}>
            {pct(v)}
          </text>
        </g>
      ))}
      {Array.from({ length: n }).map((_, i) => (
        <g key={i}>
          <rect x={x(i)} y={y(100)} width={bw} height={H - PB - y(100)} rx={6} fill="none" stroke={GHOST_STROKE} strokeDasharray="4 4" />
          <text x={x(i) + bw / 2} y={H - 9} textAnchor="middle" fontSize={9.5} fill={GHOST_STROKE}>
            {WEEKLY_COPY.ghostWeek}
          </text>
        </g>
      ))}
      <line x1={PL} x2={W - PR} y1={y(target)} y2={y(target)} stroke="#94a3b8" strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={PL + 2} y={y(target) - 5} fontSize={10} fontWeight={700} fill="#94a3b8">
        {WEEKLY_COPY.target(pct(target))}
      </text>
    </svg>
  )
}

function GhostCommitments() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[11px] border border-dashed border-slate-300 px-2.5 py-2">
          <div className="h-2.5 w-3/4 rounded-full border border-dashed border-slate-300" />
          <div className="mt-2 h-1.5 rounded-full border border-dashed border-slate-300" />
          <div className="mt-2 flex justify-between text-[10.5px] text-slate-300">
            <span>{WEEKLY_COPY.ghostPct}</span>
            <span>{WEEKLY_COPY.ghostCause}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function GhostDonut() {
  return (
    <div className="grid grid-cols-1 items-center gap-3.5 sm:grid-cols-[170px_1fr]">
      <svg viewBox="0 0 120 120" className="mx-auto block w-full max-w-[170px]">
        <circle cx={60} cy={60} r={50} fill="none" stroke={GHOST_STROKE} strokeDasharray="4 4" />
        <circle cx={60} cy={60} r={38} fill="none" stroke={GHOST_STROKE} strokeDasharray="4 4" />
        <text x={60} y={64} textAnchor="middle" fontSize={18} fontWeight={600} fill={GHOST_STROKE}>
          —
        </text>
      </svg>
      <div>
        {WEEKLY_COPY.ghostCauses.map((label) => (
          <div key={label} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 px-1 py-1.5 text-xs text-slate-300">
            <i className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-slate-300" />
            <span>{label}</span>
            <b>—</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function GhostLockBars() {
  return (
    <div className="space-y-2.5">
      {WEEKLY_COPY.ghostLocks.map((label) => (
        <div key={label} className="grid grid-cols-[110px_1fr_28px] items-center gap-2 text-xs text-slate-300">
          <span>{label}</span>
          <div className="h-4 rounded-md border border-dashed border-slate-300" />
          <b className="text-left">—</b>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const W = 120
  const H = 40
  const lo = Math.min(0.8, ...values.map((v) => v - 0.02))
  const hi = Math.max(1.04, ...values.map((v) => v + 0.02))
  const step = (W - 10) / (values.length - 1)
  const x = (i: number) => W - 5 - i * step
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8)
  const last = values[values.length - 1]!
  const color = TONE_COLOR[indexTone(last)]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-10 w-full" aria-hidden>
      <line x1={0} x2={W} y1={y(1)} y2={y(1)} stroke="#c9c5bc" strokeDasharray="3 3" />
      <polyline
        points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r={3.2} fill={color} />
    </svg>
  )
}

function PpcTrend({ data }: { data: WeeklyCommitmentsData }) {
  const W = 560
  const H = 240
  const PL = 8
  const PR = 36
  const PT = 26
  const PB = 30
  const n = Math.max(data.weeks.length, 1)
  const slot = (W - PL - PR) / Math.max(n, 6)
  const bw = slot * 0.6
  const x = (i: number) => W - PR - (i + 1) * slot + (slot - bw) / 2
  const y = (v: number) => PT + ((100 - v) / 100) * (H - PT - PB)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img" aria-label={WEEKLY_COPY.trendAria}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#eeece8" />
          <text x={W - PR + 6} y={y(v) + 4} fontSize={10} fill="#8a867e">
            {pct(v)}
          </text>
        </g>
      ))}
      {data.weeks.map((w, i) => {
        const last = i === data.weeks.length - 1
        const v = w.ppc ?? 0
        return (
          <g key={w.start}>
            <rect
              x={x(i)}
              y={y(v)}
              width={bw}
              height={H - PB - y(v)}
              rx={6}
              fill={TONE_COLOR[ppcTone(v, data.target)]}
              opacity={w.live ? 0.45 : last ? 1 : 0.72}
              stroke={last ? '#1c1b19' : undefined}
              strokeWidth={last ? 2 : undefined}
              strokeDasharray={w.live ? '5 3' : undefined}
            >
              <title>{WEEKLY_COPY.weekLive(faNumber(w.weekNumber), jalaliDate(w.start), w.live ? WEEKLY_COPY.liveSuffix : '', faNumber(w.completed), faNumber(w.planned), w.ppc == null ? '—' : pct(w.ppc))}</title>
            </rect>
            <text x={x(i) + bw / 2} y={y(v) - 6} textAnchor="middle" fontSize={last ? 12 : 10} fontWeight={last ? 800 : 600} fill={last ? '#1c1b19' : '#8a867e'}>
              {w.ppc == null ? '—' : faNumber(Math.round(w.ppc))}
            </text>
            <text x={x(i) + bw / 2} y={H - 10} textAnchor="middle" fontSize={9.5} fontWeight={last ? 800 : 400} fill={last ? '#1c1b19' : '#8a867e'}>
              {w.live ? WEEKLY_COPY.currentWeek : WEEKLY_COPY.weekN(faNumber(w.weekNumber))}
            </text>
          </g>
        )
      })}
      <line x1={PL} x2={W - PR} y1={y(data.target)} y2={y(data.target)} stroke="#1c1b19" strokeWidth={1.6} strokeDasharray="5 4" />
      <text x={PL + 2} y={y(data.target) - 5} fontSize={10} fontWeight={700} fill="#1c1b19">
        {WEEKLY_COPY.target(pct(data.target))}
      </text>
    </svg>
  )
}

function RncDonut({ data }: { data: WeeklyCommitmentsData }) {
  const { causes, total } = data.rnc
  let offset = 0
  return (
    <div className="mt-2.5 grid grid-cols-1 items-center gap-3.5 sm:grid-cols-[170px_1fr]">
      <svg viewBox="0 0 120 120" className="mx-auto block w-full max-w-[170px]" role="img" aria-label={WEEKLY_COPY.rncAria}>
        {causes.map((c) => {
          const len = Math.max(c.share - 1, 0.1)
          const el = (
            <circle
              key={c.key}
              cx={60}
              cy={60}
              r={44}
              fill="none"
              stroke={CAUSE_COLOR[c.key]}
              strokeWidth={6}
              pathLength={100}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          )
          offset += c.share
          return el
        })}
        <text x={60} y={58} textAnchor="middle" fontSize={16} fontWeight={500}>
          {faNumber(total)}
        </text>
        <text x={60} y={74} textAnchor="middle" fontSize={9} fill="#8a867e">
          {WEEKLY_COPY.unfinished}
        </text>
      </svg>
      <div>
        {causes.map((c) => (
          <div key={c.key} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 px-1 py-1.5 text-xs">
            <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: CAUSE_COLOR[c.key] }} />
            <span>{c.label}</span>
            <b className="tabular-nums">
              {faNumber(c.count)}
              <small className="ms-1.5 font-normal text-slate-500">{pct(c.share)}</small>
            </b>
          </div>
        ))}
      </div>
    </div>
  )
}

const LOCKS_MISSING = WEEKLY_COPY.locksMissing

function WeeklyCommitmentsBody({
  overview,
  controls,
  wwp,
  livePpc,
}: {
  overview: ManagerOverview
  controls: Load<ControlsBody>
  wwp: Load<WeeklyCommitmentsResult>
  livePpc: ReturnType<typeof useStoreWeeklyPpc>
}) {
  const kpis = controls.state === 'ok' ? controls.data.kpis : null
  const snapshot = controls.state === 'ok' ? controls.data.snapshot : null
  const spi = kpis?.spi ?? null
  const spiT = kpis?.spi_t ?? null
  const es = kpis?.es?.value ?? null
  const at = kpis?.at?.value ?? null
  const unitFa = snapshot?.periodUnit === 'weeks' ? WEEKLY_COPY.unitWeek : snapshot?.periodUnit === 'days' ? WEEKLY_COPY.unitDay : WEEKLY_COPY.unitMonth

  const history = useMemo(() => {
    if (!snapshot || overview.progress.status !== 'ok') return { spi: [], spiT: [] }
    const h = indexHistoryFromCurve({
      points: overview.progress.data.points,
      pvCurve: snapshot.pvCurve.value,
      projectStart: snapshot.projectStart.value,
      plannedDuration: snapshot.plannedDuration.value,
      daysPerUnit: snapshot.daysPerUnit,
      today: snapshot.asOf,
    })
    return {
      spi: spi?.value != null ? [...h.spi, spi.value] : h.spi,
      spiT: spiT?.value != null ? [...h.spiT, spiT.value] : h.spiT,
    }
  }, [snapshot, overview.progress, spi?.value, spiT?.value])

  const serverPpc = wwp.state === 'ok' && wwp.data.status === 'ok' ? wwp.data.data : null
  const ppcData = useMemo(() => withStorePpc(serverPpc, livePpc), [serverPpc, livePpc])
  const ppcMissing =
    wwp.state === 'error' ? WEEKLY_COPY.wwpFailed(wwp.message) : wwp.state === 'ok' && wwp.data.status === 'missing' ? wwp.data.reason_fa : null
  const current = ppcData?.current ?? null
  const ppc = current?.ppc ?? null

  const bannerParts: string[] = []
  if (ppcData && ppc != null) {
    const gap = ppcData.target - ppc
    const which = current?.live ? WEEKLY_COPY.whichLive : WEEKLY_COPY.whichClosed
    bannerParts.push(
      gap > 0
        ? WEEKLY_COPY.ppcBelow(which, pct(ppc), faNumber(Math.round(gap)))
        : WEEKLY_COPY.ppcMet(which, pct(ppc), pct(ppcData.target))
    )
    const top = ppcData.rnc.causes[0]
    if (top) bannerParts.push(WEEKLY_COPY.topCause(faNumber(ppcData.rnc.weeks), top.label, pct(top.share)))
  } else if (ppcMissing) {
    bannerParts.push(WEEKLY_COPY.ppcUnknown(ppcMissing))
  }
  if (spi?.value != null && spiT?.value != null) {
    bannerParts.push(WEEKLY_COPY.spiPair(faNumber(spi.value, 2), faNumber(spiT.value, 2)))
  }
  const bannerTone: PpcTone =
    ppc != null ? ppcTone(ppc, ppcData!.target) : spiT?.value != null ? indexTone(spiT.value) : 'warn'

  const evPct = snapshot?.ev.value ?? null
  const pvPct = snapshot?.pv.value ?? null
  const ppcTn = ppc != null && ppcData ? ppcTone(ppc, ppcData.target) : null
  const delta = ppc != null && ppcData?.previousPpc != null ? ppc - ppcData.previousPpc : null
  const helpCtx: HelpContext = {
    ppcData,
    ppcMissing,
    spi: spi?.value ?? null,
    spiT: spiT?.value ?? null,
    evPct,
    pvPct,
    es,
    at,
    unitFa,
  }

  return (
    <div className="space-y-3.5">
      <p className="max-w-3xl text-xs leading-6 text-slate-500">
        {WEEKLY_COPY.intro}
      </p>

      {bannerParts.length ? (
        <div
          role="status"
          className={cn(
            'rounded-2xl border px-4 py-3 text-[13px] font-semibold leading-7',
            bannerTone === 'good'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : bannerTone === 'bad'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          )}
        >
          {bannerParts.join(' ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.ppcTitle}
            en={WEEKLY_COPY.ppcEn}
            help={<PpcHelp ctx={helpCtx} />}
            chip={ppcTn ? <Chip tone={ppcTn} label={PPC_LABEL[ppcTn]} /> : <Chip tone="none" label={WEEKLY_COPY.noData} />}
          />
          {wwp.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : current && ppc != null && ppcData ? (
            <>
              <p className="mb-1 mt-3 text-[22px] font-medium leading-none tabular-nums" style={{ color: TONE_COLOR[ppcTn!] }}>
                {pct(ppc)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                {current.live ? <span className="me-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-bold text-sky-700">{WEEKLY_COPY.liveChip}</span> : null}{' '}
                <b className="text-slate-800">
                  {faNumber(current.completed)}
                  {WEEKLY_COPY.ofPlanned}
                  {faNumber(current.planned)}
                </b>{' '}
                {ppcData.source === 'schedule'
                  ? WEEKLY_COPY.scheduleDone(faNumber(current.weekNumber), jalaliDate(current.start), jalaliDate(current.end))
                  : WEEKLY_COPY.commitDone(faNumber(current.weekNumber), jalaliDate(current.start), jalaliDate(current.end))}
                <br />
                {delta != null ? WEEKLY_COPY.vsPrev(faNumber(Math.abs(Math.round(delta))), delta < 0) : WEEKLY_COPY.noPrev}
                {ppcData.average4 != null ? WEEKLY_COPY.avg(faNumber(ppcData.rnc.weeks), pct(ppcData.average4)) : ''}
              </p>
            </>
          ) : (
            <Ghost reason={ppcMissing ?? WEEKLY_COPY.noValue}>
              <GhostValue />
            </Ghost>
          )}
        </div>

        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.spiTitle}
            en={WEEKLY_COPY.spiEn}
            help={<SpiHelp ctx={helpCtx} />}
            chip={spi?.value != null ? <Chip tone={indexTone(spi.value)} label={INDEX_LABEL[indexTone(spi.value)]} /> : <Chip tone="none" label={WEEKLY_COPY.noData} />}
          />
          {controls.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : spi?.value != null ? (
            <>
              <p className="mb-1 mt-3 text-[22px] font-medium leading-none tabular-nums" style={{ color: TONE_COLOR[indexTone(spi.value)] }}>
                {faNumber(spi.value, 2)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                {evPct != null && pvPct != null ? (
                  <>
                    {WEEKLY_COPY.evOfPv}<b className="text-slate-800">{faNumber(evPct, 1)}{MANAGER_PUNCT.percent}</b>{WEEKLY_COPY.ofPlanned}<b className="text-slate-800">{faNumber(pvPct, 1)}{MANAGER_PUNCT.percent}</b>{WEEKLY_COPY.plannedSuffix}
                    <br />
                  </>
                ) : null}
                {WEEKLY_COPY.meaning(faNumber(Math.round(spi.value * 100)))}
              </p>
              <Sparkline values={history.spi} />
            </>
          ) : (
            <Missing text={controls.state === 'error' ? controls.message : spi?.reason_fa ?? WEEKLY_COPY.noValue} />
          )}
        </div>

        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.spitTitle}
            en={WEEKLY_COPY.spitEn}
            help={<SpiTHelp ctx={helpCtx} />}
            chip={spiT?.value != null ? <Chip tone={indexTone(spiT.value)} label={INDEX_LABEL[indexTone(spiT.value)]} /> : <Chip tone="none" label={WEEKLY_COPY.noData} />}
          />
          {controls.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : spiT?.value != null ? (
            <>
              <p className="mb-1 mt-3 text-[22px] font-medium leading-none tabular-nums" style={{ color: TONE_COLOR[indexTone(spiT.value)] }}>
                {faNumber(spiT.value, 2)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                {es != null && at != null ? (
                  <>
                    {WEEKLY_COPY.esAt(unitFa)}<b className="text-slate-800">{faNumber(es, 1)}</b>{WEEKLY_COPY.planIs}{' '}
                    <b className="text-slate-800">{faNumber(at, 1)}</b>{WEEKLY_COPY.unitPassed(unitFa)}
                    <br />
                    {at > es ? WEEKLY_COPY.behind(faNumber(at - es, 1), unitFa) : WEEKLY_COPY.onOrAhead}
                  </>
                ) : (
                  spiT.interpretation_fa
                )}
              </p>
              <Sparkline values={history.spiT} />
            </>
          ) : (
            <Missing text={controls.state === 'error' ? controls.message : spiT?.reason_fa ?? WEEKLY_COPY.noValue} />
          )}
        </div>

        <div className={cn(CARD, 'border-rose-200 bg-rose-50/60')}>
          <CardTop title={WEEKLY_COPY.locksNext} sub={WEEKLY_COPY.locksNextSub} help={<LocksHelp />} />
          <div className="mt-2.5 flex items-center gap-3">
            <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border-[1.5px] border-rose-300 bg-rose-100">
              <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden />
            </span>
            <span className="text-[22px] font-medium text-slate-400">—</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-6 text-slate-600">{WEEKLY_COPY.locksNote}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.trendTitle}
            help={<TrendHelp ctx={helpCtx} />}
            sub={
              ppcData
                ? WEEKLY_COPY.trendSub(faNumber(ppcData.weeks.filter((w) => !w.live).length), ppcData.weeks.some((w) => w.live))
                : WEEKLY_COPY.trendEmpty
            }
          />
          {ppcData && ppcData.weeks.length ? (
            <PpcTrend data={ppcData} />
          ) : (
            <Ghost reason={ppcMissing ?? WEEKLY_COPY.noClosedWeek}>
              <GhostPpcTrend target={ppcData?.target ?? 80} />
            </Ghost>
          )}
        </div>
        <div className={CARD}>
          <CardTop
            title={
              current
                ? `${ppcData?.source === 'schedule' ? WEEKLY_COPY.scheduleActs : WEEKLY_COPY.commitActs} ${current.live ? WEEKLY_COPY.currentWeek : WEEKLY_COPY.weekN(faNumber(current.weekNumber))}`
                : WEEKLY_COPY.lastWeekActs
            }
            help={<CommitmentsHelp ctx={helpCtx} />}
            sub={
              ppcData?.source === 'schedule'
                ? WEEKLY_COPY.scheduleSub
                : WEEKLY_COPY.commitSub
            }
          />
          {current && current.commitments.length ? (
            <>
              <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {current.commitments.map((c, i) =>
                  c.completed ? (
                    <div key={i} className="flex min-w-0 items-center gap-2 rounded-[11px] border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11.5px] text-emerald-900">
                      <i className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] not-italic text-white">✓</i>
                      <b className="flex-1 truncate font-semibold" title={c.description}>
                        {c.description}
                      </b>
                      <em className="text-[11px] font-extrabold not-italic">
                        {c.targetPercent != null && c.actualPercent != null
                          ? `${pctUpTo1(c.actualPercent)} / ${pctUpTo1(c.targetPercent)}`
                          : pct(100)}
                      </em>
                    </div>
                  ) : (
                    <div key={i} className="min-w-0 rounded-[11px] border-[1.5px] border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] leading-6">
                      <b className="block truncate font-semibold" title={c.description}>
                        {c.description}
                      </b>
                      {c.progressPercent != null ? (
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rose-200/70">
                          <span className="block h-full rounded-full bg-rose-500" style={{ width: `${c.progressPercent}%` }} />
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center justify-between gap-1.5 text-[10.5px]">
                        <span className="text-[13px] font-extrabold text-rose-600">
                          {c.targetPercent != null && c.actualPercent != null
                            ? WEEKLY_COPY.ofPlan(pctUpTo1(c.actualPercent), pctUpTo1(c.targetPercent))
                            : c.progressPercent != null
                              ? WEEKLY_COPY.progress(pct(c.progressPercent))
                              : WEEKLY_COPY.notDone}
                        </span>
                        {c.rootCause ? (
                          <span className="font-bold" style={{ color: CAUSE_COLOR[c.rootCause] }} title={c.rootCauseNote ?? undefined}>
                            {c.rootCauseLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </div>
              <p className="mt-3 rounded-[10px] border border-slate-200 bg-[#faf9f7] px-3 py-2 text-xs leading-6 text-slate-500">
                {ppcData?.source === 'schedule'
                  ? WEEKLY_COPY.scoreRule
                  : WEEKLY_COPY.halfZero}
              </p>
            </>
          ) : (
            <Ghost reason={ppcMissing ?? WEEKLY_COPY.noCommit}>
              <GhostCommitments />
            </Ghost>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.55fr]">
        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.rncTitle}
            help={<RncHelp />}
            sub={WEEKLY_COPY.rncSub(faNumber(ppcData?.rnc.weeks || 4))}
          />
          {ppcData && ppcData.rnc.total > 0 ? (
            <>
              <RncDonut data={ppcData} />
              {ppcData.rnc.top3Share != null ? (
                <p className="mt-2.5 rounded-[10px] border border-slate-200 bg-[#faf9f7] px-3 py-2 text-[11.5px] leading-6 text-slate-500">
                  <b className="text-slate-800">{pct(ppcData.rnc.top3Share)}</b>
                  {WEEKLY_COPY.topShare}
                  {faNumber(Math.min(3, ppcData.rnc.causes.length))}
                  {WEEKLY_COPY.topCauses}
                  {ppcData.rnc.causes
                    .slice(0, 3)
                    .map((c) => c.label)
                    .join(MANAGER_PUNCT.list)}
                  {WEEKLY_COPY.focus}
                </p>
              ) : null}
            </>
          ) : (
            <Ghost
              reason={
                ppcData?.source === 'schedule'
                  ? WEEKLY_COPY.rncLater
                  : ppcData
                    ? WEEKLY_COPY.rncNone
                    : ppcMissing ?? WEEKLY_COPY.noValue
              }
            >
              <GhostDonut />
            </Ghost>
          )}
        </div>
        <div className={CARD}>
          <CardTop
            title={WEEKLY_COPY.locksAhead}
            sub={WEEKLY_COPY.locksAheadSub}
            help={<LocksHelp />}
          />
          <Ghost reason={LOCKS_MISSING}>
            <GhostLockBars />
          </Ghost>
        </div>
      </div>

      <details className={CARD}>
        <summary className="cursor-pointer py-1 text-sm font-bold text-slate-800">{WEEKLY_COPY.glossaryTitle}</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs leading-7 text-slate-700 md:grid-cols-2">
          {[
            [WEEKLY_COPY.glossary.ppc, WEEKLY_COPY.glossary.ppcBody(pct(ppcData?.target ?? 80))],
            [WEEKLY_COPY.glossary.rnc, WEEKLY_COPY.glossary.rncBody],
            [WEEKLY_COPY.glossary.locks, WEEKLY_COPY.glossary.locksBody],
            [WEEKLY_COPY.glossary.spi, WEEKLY_COPY.glossary.spiBody],
            [WEEKLY_COPY.glossary.spit, WEEKLY_COPY.glossary.spitBody],
            [WEEKLY_COPY.glossary.together, WEEKLY_COPY.glossary.togetherBody],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-[#faf9f7] px-3.5 py-2.5">
              <b className="mb-0.5 block text-[13px]">{title}</b>
              {body}
            </div>
          ))}
        </div>
      </details>

      <p className="text-[11px] text-slate-500">
        {WEEKLY_COPY.footer(pct(ppcData?.target ?? 80), pct(PPC_LOW))}
      </p>
    </div>
  )
}

export function WeeklyCommitmentsSection({
  projectId,
  overview,
  loading,
  className,
}: {
  projectId: string | null
  overview: ManagerOverview | null
  loading: boolean
  className?: string
}) {
  const refreshKey = overview?.generatedAt ?? null
  const id = projectId ? encodeURIComponent(projectId) : null
  const controls = useJson<ControlsBody>(id ? `/api/manager/controls?projectId=${id}&unit=weeks` : null, refreshKey)
  const wwp = useJson<WeeklyCommitmentsResult & { traces?: CalcTraceMap }>(
    id ? `/api/manager/weekly-commitments?projectId=${id}` : null,
    refreshKey
  )
  const traces = wwp.state === 'ok' ? { ...overview?.traces, ...wwp.data.traces } : overview?.traces
  const livePpc = useStoreWeeklyPpc(projectId, { savedOnly: true })

  return (
    <CalcTraceProvider traces={traces}>
    <SectionCard
      className={cn('border-2 border-[#1e2a5e] bg-[#eef4fb]', className)}
      title={WEEKLY_COPY.ppcTitle}
      icon={<CalendarCheck className="h-4 w-4" aria-hidden />}
      action={<CalcTraceTrigger metrics={['home.ppc', 'home.spi_t']} />}
      hint={WEEKLY_COPY.cardHint}
    >
      {!overview ? (
        loading ? <LoadingRows rows={6} /> : <Missing text={WEEKLY_COPY.notLoaded} />
      ) : (
        <WeeklyCommitmentsBody overview={overview} controls={controls} wwp={wwp} livePpc={livePpc} />
      )}
    </SectionCard>
    </CalcTraceProvider>
  )
}
