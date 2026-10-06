'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarCheck } from 'lucide-react'
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
import { LoadingRows, SectionCard } from './manager-ui'

const TONE_COLOR: Record<PpcTone, string> = { good: '#12a06b', warn: '#f5a524', bad: '#e5484d' }
const TONE_CHIP: Record<PpcTone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
}
const PPC_LABEL: Record<PpcTone, string> = { good: 'در هدف', warn: 'زیر هدف', bad: 'پایین' }
const INDEX_LABEL: Record<PpcTone, string> = { good: 'طبق برنامه', warn: 'کمی عقب', bad: 'عقب از برنامه' }

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
        if (!response.ok || body?.error) setLoad({ state: 'error', message: body?.error ?? `خطای ${response.status}` })
        else setLoad({ state: 'ok', data: body as T })
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ state: 'error', message: error instanceof Error ? error.message : 'خطای شبکه' })
      })
    return () => {
      cancelled = true
    }
  }, [url, refreshKey])
  return load
}

const pct = (v: number) => `${faNumber(Math.round(v))}٪`

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

function CardTop({ title, sub, en, chip }: { title: string; sub?: string; en?: string; chip?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2.5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
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
          بدون داده
        </span>
      </div>
      <p className="mt-2 text-[10.5px] leading-5 text-slate-400">{reason}</p>
    </div>
  )
}

function GhostValue() {
  return (
    <div className="mt-1">
      <p className="text-[40px] font-extrabold leading-none tabular-nums text-transparent" style={{ WebkitTextStroke: `1.5px ${GHOST_STROKE}` }}>
        —٪
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
            هفتهٔ —
          </text>
        </g>
      ))}
      <line x1={PL} x2={W - PR} y1={y(target)} y2={y(target)} stroke="#94a3b8" strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={PL + 2} y={y(target) - 5} fontSize={10} fontWeight={700} fill="#94a3b8">
        {`هدف ${pct(target)}`}
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
            <span>—٪</span>
            <span>علت —</span>
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
        <circle cx={60} cy={60} r={34} fill="none" stroke={GHOST_STROKE} strokeDasharray="4 4" />
        <text x={60} y={64} textAnchor="middle" fontSize={22} fontWeight={800} fill={GHOST_STROKE}>
          —
        </text>
      </svg>
      <div>
        {['مصالح', 'اکیپ', 'نقشه و اطلاعات فنی', 'تجهیزات'].map((label) => (
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
      {['مصالح', 'نقشه و اطلاعات فنی', 'اکیپ', 'تجهیزات', 'مجوز'].map((label) => (
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
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img" aria-label="روند هفتگی PPC">
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
              opacity={last ? 1 : 0.72}
              stroke={last ? '#1c1b19' : undefined}
              strokeWidth={last ? 2 : undefined}
            >
              <title>{`هفتهٔ ${faNumber(w.weekNumber)} (${jalaliDate(w.start)}): ${faNumber(w.completed)} از ${faNumber(w.planned)} کار · ${w.ppc == null ? '—' : pct(w.ppc)}`}</title>
            </rect>
            <text x={x(i) + bw / 2} y={y(v) - 6} textAnchor="middle" fontSize={last ? 12 : 10} fontWeight={last ? 800 : 600} fill={last ? '#1c1b19' : '#8a867e'}>
              {w.ppc == null ? '—' : faNumber(Math.round(w.ppc))}
            </text>
            <text x={x(i) + bw / 2} y={H - 10} textAnchor="middle" fontSize={9.5} fontWeight={last ? 800 : 400} fill={last ? '#1c1b19' : '#8a867e'}>
              {`هفتهٔ ${faNumber(w.weekNumber)}`}
            </text>
          </g>
        )
      })}
      <line x1={PL} x2={W - PR} y1={y(data.target)} y2={y(data.target)} stroke="#1c1b19" strokeWidth={1.6} strokeDasharray="5 4" />
      <text x={PL + 2} y={y(data.target) - 5} fontSize={10} fontWeight={700} fill="#1c1b19">
        {`هدف ${pct(data.target)}`}
      </text>
    </svg>
  )
}

function RncDonut({ data }: { data: WeeklyCommitmentsData }) {
  const { causes, total } = data.rnc
  let offset = 0
  return (
    <div className="mt-2.5 grid grid-cols-1 items-center gap-3.5 sm:grid-cols-[170px_1fr]">
      <svg viewBox="0 0 120 120" className="mx-auto block w-full max-w-[170px]" role="img" aria-label="سهم علل عدم تحقق">
        {causes.map((c) => {
          const len = Math.max(c.share - 1, 0.1)
          const el = (
            <circle
              key={c.key}
              cx={60}
              cy={60}
              r={42}
              fill="none"
              stroke={CAUSE_COLOR[c.key]}
              strokeWidth={16}
              pathLength={100}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          )
          offset += c.share
          return el
        })}
        <text x={60} y={60} textAnchor="middle" fontSize={24} fontWeight={800}>
          {faNumber(total)}
        </text>
        <text x={60} y={76} textAnchor="middle" fontSize={8.5} fill="#8a867e">
          کار ناتمام
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

const LOCKS_MISSING =
  'ثبت «قفل‌ها» (محدودیت‌های Look-ahead هر فعالیت: نوع قفل، تاریخ رفع مورد انتظار، وضعیت و اثر روی مسیر بحرانی) هنوز در سامانه وجود ندارد؛ بدون آن تعداد قفل‌ها و آمادگی کارهای هفته‌های آینده قابل محاسبه نیست.'

function WeeklyCommitmentsBody({
  overview,
  controls,
  wwp,
}: {
  overview: ManagerOverview
  controls: Load<ControlsBody>
  wwp: Load<WeeklyCommitmentsResult>
}) {
  const kpis = controls.state === 'ok' ? controls.data.kpis : null
  const snapshot = controls.state === 'ok' ? controls.data.snapshot : null
  const spi = kpis?.spi ?? null
  const spiT = kpis?.spi_t ?? null
  const es = kpis?.es?.value ?? null
  const at = kpis?.at?.value ?? null
  const unitFa = snapshot?.periodUnit === 'weeks' ? 'هفته' : snapshot?.periodUnit === 'days' ? 'روز' : 'ماه'

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

  const ppcData = wwp.state === 'ok' && wwp.data.status === 'ok' ? wwp.data.data : null
  const ppcMissing =
    wwp.state === 'error' ? `بارگذاری برنامهٔ هفتگی ناموفق بود: ${wwp.message}` : wwp.state === 'ok' && wwp.data.status === 'missing' ? wwp.data.reason_fa : null
  const current = ppcData?.current ?? null
  const ppc = current?.ppc ?? null

  const bannerParts: string[] = []
  if (ppcData && ppc != null) {
    const gap = ppcData.target - ppc
    bannerParts.push(
      gap > 0
        ? `PPC آخرین هفتهٔ بسته‌شده ${pct(ppc)} است؛ ${faNumber(Math.round(gap))} واحد زیر هدف.`
        : `PPC آخرین هفتهٔ بسته‌شده ${pct(ppc)} است و به هدف ${pct(ppcData.target)} رسیده.`
    )
    const top = ppcData.rnc.causes[0]
    if (top) bannerParts.push(`علت ریشه‌ای اصلی در ${faNumber(ppcData.rnc.weeks)} هفتهٔ اخیر «${top.label}» بوده (${pct(top.share)}).`)
  } else if (ppcMissing) {
    bannerParts.push(`PPC هنوز قابل محاسبه نیست: ${ppcMissing}.`)
  }
  if (spi?.value != null && spiT?.value != null) {
    bannerParts.push(`SPI برابر ${faNumber(spi.value, 2)} و SPI(t) برابر ${faNumber(spiT.value, 2)} است.`)
  }
  const bannerTone: PpcTone =
    ppc != null ? ppcTone(ppc, ppcData!.target) : spiT?.value != null ? indexTone(spiT.value) : 'warn'

  const evPct = snapshot?.ev.value ?? null
  const pvPct = snapshot?.pv.value ?? null
  const ppcTn = ppc != null && ppcData ? ppcTone(ppc, ppcData.target) : null
  const delta = ppc != null && ppcData?.previousPpc != null ? ppc - ppcData.previousPpc : null

  return (
    <div className="space-y-3.5">
      <p className="max-w-3xl text-xs leading-6 text-slate-500">
        PPC نشان می‌دهد کارگاه به قول‌های هفتگی‌اش چقدر پایبند بوده (شاخص پیشرو)؛ SPI و SPI(t) نشان می‌دهند پروژه نسبت به برنامهٔ مبنا کجاست
        (شاخص پسرو). کنار هم، هم «چرا» را می‌بینی و هم «چقدر».
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
            title="شاخص تعهدات هفتگی (PPC)"
            en="Percent Plan Complete"
            chip={ppcTn ? <Chip tone={ppcTn} label={PPC_LABEL[ppcTn]} /> : <Chip tone="none" label="بدون داده" />}
          />
          {wwp.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : current && ppc != null && ppcData ? (
            <>
              <p className="mb-1 mt-3 text-[40px] font-extrabold leading-none tabular-nums" style={{ color: TONE_COLOR[ppcTn!] }}>
                {pct(ppc)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                <b className="text-slate-800">
                  {faNumber(current.completed)} از {faNumber(current.planned)}
                </b>{' '}
                کار تعهدشدهٔ هفتهٔ {faNumber(current.weekNumber)} ({jalaliDate(current.start)} تا {jalaliDate(current.end)}) کامل شد
                <br />
                {delta != null ? `${delta < 0 ? '▼' : '▲'} ${faNumber(Math.abs(Math.round(delta)))} واحد درصد نسبت به هفتهٔ قبل` : 'هفتهٔ قبلی برای مقایسه نیست'}
                {ppcData.average4 != null ? ` · میانگین ${faNumber(ppcData.rnc.weeks)} هفته ${pct(ppcData.average4)}` : ''}
              </p>
            </>
          ) : (
            <Ghost reason={ppcMissing ?? 'داده‌ای نیست'}>
              <GhostValue />
            </Ghost>
          )}
        </div>

        <div className={CARD}>
          <CardTop
            title="شاخص عملکرد زمانی (SPI)"
            en="Schedule Performance Index"
            chip={spi?.value != null ? <Chip tone={indexTone(spi.value)} label={INDEX_LABEL[indexTone(spi.value)]} /> : <Chip tone="none" label="بدون داده" />}
          />
          {controls.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : spi?.value != null ? (
            <>
              <p className="mb-1 mt-3 text-[40px] font-extrabold leading-none tabular-nums" style={{ color: TONE_COLOR[indexTone(spi.value)] }}>
                {faNumber(spi.value, 2)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                {evPct != null && pvPct != null ? (
                  <>
                    ارزش کار انجام‌شده <b className="text-slate-800">{faNumber(evPct, 1)}٪</b> از <b className="text-slate-800">{faNumber(pvPct, 1)}٪</b> برنامه‌شده
                    <br />
                  </>
                ) : null}
                یعنی هر ۱۰۰ واحد کار برنامه‌شده، {faNumber(Math.round(spi.value * 100))} واحد انجام شده
              </p>
              <Sparkline values={history.spi} />
            </>
          ) : (
            <Missing text={controls.state === 'error' ? controls.message : spi?.reason_fa ?? 'داده‌ای نیست'} />
          )}
        </div>

        <div className={CARD}>
          <CardTop
            title="شاخص عملکرد زمانی (SPI(t))"
            en="Time-based SPI · Earned Schedule"
            chip={spiT?.value != null ? <Chip tone={indexTone(spiT.value)} label={INDEX_LABEL[indexTone(spiT.value)]} /> : <Chip tone="none" label="بدون داده" />}
          />
          {controls.state === 'loading' ? (
            <div className="mt-3">
              <LoadingRows rows={2} />
            </div>
          ) : spiT?.value != null ? (
            <>
              <p className="mb-1 mt-3 text-[40px] font-extrabold leading-none tabular-nums" style={{ color: TONE_COLOR[indexTone(spiT.value)] }}>
                {faNumber(spiT.value, 2)}
              </p>
              <p className="min-h-[42px] text-[11.5px] leading-7 text-slate-500">
                {es != null && at != null ? (
                  <>
                    پیشرفت فعلی معادل {unitFa} <b className="text-slate-800">{faNumber(es, 1)}</b> برنامه است، در حالی که{' '}
                    <b className="text-slate-800">{faNumber(at, 1)}</b> {unitFa} گذشته
                    <br />
                    {at > es ? `حدود ${faNumber(at - es, 1)} ${unitFa} عقب‌تر از برنامه` : 'هم‌پای برنامه یا جلوتر'}
                  </>
                ) : (
                  spiT.interpretation_fa
                )}
              </p>
              <Sparkline values={history.spiT} />
            </>
          ) : (
            <Missing text={controls.state === 'error' ? controls.message : spiT?.reason_fa ?? 'داده‌ای نیست'} />
          )}
        </div>

        <div className={cn(CARD, 'border-rose-200 bg-rose-50/60')}>
          <CardTop title="قفل‌های هفتهٔ آینده" sub="کارهایی که به‌خاطر یک محدودیت هنوز آمادهٔ اجرا نیستند" />
          <div className="mt-2.5 flex items-center gap-3">
            <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full border-[1.5px] border-rose-300 bg-rose-100">
              <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden />
            </span>
            <span className="text-[30px] font-extrabold text-slate-400">—</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-6 text-slate-600">قفل‌ها هنوز در سامانه ثبت نمی‌شوند؛ جزئیات در کادر «قفل‌های هفته‌های آینده».</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.2fr_1fr]">
        <div className={CARD}>
          <CardTop title="روند هفتگی PPC" sub={ppcData ? `${faNumber(ppcData.weeks.length)} هفتهٔ بسته‌شدهٔ اخیر در برابر هدف` : 'هفته‌های بسته‌شدهٔ اخیر در برابر هدف'} />
          {ppcData && ppcData.weeks.length ? (
            <PpcTrend data={ppcData} />
          ) : (
            <Ghost reason={ppcMissing ?? 'هفتهٔ بسته‌شده‌ای نیست'}>
              <GhostPpcTrend target={ppcData?.target ?? 80} />
            </Ghost>
          )}
        </div>
        <div className={CARD}>
          <CardTop
            title={current ? `کارهای تعهدشدهٔ هفتهٔ ${faNumber(current.weekNumber)}` : 'کارهای تعهدشدهٔ آخرین هفته'}
            sub="هر کادر یک کار است؛ ناتمام‌ها اول آمده‌اند"
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
                      <em className="text-[11px] font-extrabold not-italic">{pct(100)}</em>
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
                          {c.progressPercent != null ? `${pct(c.progressPercent)} پیشرفت` : 'انجام نشد'}
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
                کار نیمه‌تمام در PPC صفر حساب می‌شود؛ حتی کاری که بخشی از آن پیش رفته هنوز «انجام‌نشده» است.
              </p>
            </>
          ) : (
            <Ghost reason={ppcMissing ?? 'برای این هفته تعهدی ثبت نشده است'}>
              <GhostCommitments />
            </Ghost>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.55fr]">
        <div className={CARD}>
          <CardTop
            title="علل ریشه‌ای عدم تحقق (RNC)"
            sub={`Reasons for Non-Completion · سهم هر علت در ${faNumber(ppcData?.rnc.weeks || 4)} هفتهٔ اخیر`}
          />
          {ppcData && ppcData.rnc.total > 0 ? (
            <>
              <RncDonut data={ppcData} />
              {ppcData.rnc.top3Share != null ? (
                <p className="mt-2.5 rounded-[10px] border border-slate-200 bg-[#faf9f7] px-3 py-2 text-[11.5px] leading-6 text-slate-500">
                  <b className="text-slate-800">{pct(ppcData.rnc.top3Share)}</b> ناتمامی‌ها از{' '}
                  {faNumber(Math.min(3, ppcData.rnc.causes.length))} علت ریشه‌ای اول است:{' '}
                  {ppcData.rnc.causes
                    .slice(0, 3)
                    .map((c) => c.label)
                    .join('، ')}
                  . روی همین‌ها تمرکز کنید.
                </p>
              ) : null}
            </>
          ) : (
            <Ghost reason={ppcData ? 'در این هفته‌ها همهٔ تعهدات انجام شده و علتی ثبت نشده است.' : ppcMissing ?? 'داده‌ای نیست'}>
              <GhostDonut />
            </Ghost>
          )}
        </div>
        <div className={CARD}>
          <CardTop title="قفل‌های هفته‌های آینده" sub="تعداد کارهایی که به‌علت هر قفل (محدودیت) هنوز آماده اجرا نیستند" />
          <Ghost reason={LOCKS_MISSING}>
            <GhostLockBars />
          </Ghost>
        </div>
      </div>

      <details className={CARD}>
        <summary className="cursor-pointer py-1 text-sm font-bold text-slate-800">این شاخص‌ها یعنی چه؟ (توضیح کامل)</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs leading-7 text-slate-700 md:grid-cols-2">
          {[
            ['PPC · شاخص تعهدات هفتگی', `هر هفته سرپرست‌ها متعهد می‌شوند چند کار را انجام دهند. PPC یعنی از این تعهدها چند درصد کامل شد. کار نیمه‌تمام صفر حساب می‌شود. هدف رایج ${pct(ppcData?.target ?? 80)} است. فقط هفته‌هایی که بسته و ارزیابی شده‌اند حساب می‌شوند.`],
            ['RNC · علل ریشه‌ای عدم تحقق', 'برای هر کار ناتمام یک علت ثبت می‌شود (مصالح، اکیپ، نقشه…). جمع این علت‌ها نشان می‌دهد کدام مشکل بیشترین کار را عقب انداخته؛ همان را اول حل کن.'],
            ['قفل‌ها (محدودیت‌ها) و آمادگی کار', '«قفل» هر چیزی است که جلوی شروع یک کار را می‌گیرد: مصالح، نقشه، اکیپ، تجهیزات یا مجوز. کاری «آماده» است که همهٔ قفل‌هایش باز شده باشد.'],
            ['SPI · شاخص عملکرد زمانی', 'SPI = EV ÷ PV؛ پیشرفت کسب‌شده تقسیم بر پیشرفتی که طبق برنامهٔ مبنا تا امروز باید انجام می‌شد. نزدیک پایان پروژه همیشه به ۱ میل می‌کند، حتی اگر پروژه دیر تمام شود.'],
            ['SPI(t) · بر پایهٔ زمان', 'SPI(t) = ES ÷ AT؛ زمان کسب‌شده (پیشرفت فعلی طبق برنامهٔ مبنا مربوط به کدام زمان بوده) تقسیم بر زمان واقعاً گذشته. تا آخر پروژه قابل اعتماد می‌ماند.'],
            ['این‌ها چطور کنار هم خوانده شوند؟', 'PPC شاخص پیشرو است و SPI و SPI(t) پسرو. اگر PPC چند هفته پایین بماند، SPI معمولاً دنبالش پایین می‌آید. اگر SPI و SPI(t) فاصله بگیرند، به SPI(t) بیشتر اعتماد کن.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-[#faf9f7] px-3.5 py-2.5">
              <b className="mb-0.5 block text-[13px]">{title}</b>
              {body}
            </div>
          ))}
        </div>
      </details>

      <p className="text-[11px] text-slate-500">
        PPC = کارهای کاملاً انجام‌شده ÷ کل کارهای تعهدشدهٔ هفتهٔ بسته‌شده (هدف {pct(ppcData?.target ?? 80)}، زیر {pct(PPC_LOW)} پایین). مرز رنگ SPI و
        SPI(t): ≥۱ سبز، ۰٫۹ تا ۱ زرد، زیر ۰٫۹ قرمز. روند SPI و SPI(t) از نقاط ثبت‌شدهٔ منحنی S تا امروز است.
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
  const wwp = useJson<WeeklyCommitmentsResult>(id ? `/api/manager/weekly-commitments?projectId=${id}` : null, refreshKey)

  return (
    <SectionCard
      className={cn('border-2 border-[#1e2a5e] bg-[#eef4fb]', className)}
      title="شاخص تعهدات هفتگی (PPC)"
      icon={<CalendarCheck className="h-4 w-4" aria-hidden />}
      hint="PPC از هفته‌های بسته‌شدهٔ برنامهٔ هفتگی متعهد (WWP)، SPI و SPI(t) از موتور کنترل پروژه با واحد هفته محاسبه می‌شوند."
    >
      {!overview ? (
        loading ? <LoadingRows rows={6} /> : <Missing text="داده هنوز بارگذاری نشده است" />
      ) : (
        <WeeklyCommitmentsBody overview={overview} controls={controls} wwp={wwp} />
      )}
    </SectionCard>
  )
}
