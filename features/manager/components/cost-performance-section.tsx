'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import {
buildCostPerformance,
CPI_ZONES,
moneyScale,
TCPI_ZONES,
type CostPerformanceReady,
type CostTone,
} from '@/features/manager/lib/cost-performance'
import type { ManagerEvmSummary, SectionResult } from '@/features/manager/lib/overview-types'
import { EmptyNote, SectionBody, SectionCard } from './manager-ui'

const COLOR = {
  ac: '#d9601a',
  ev: '#2f6fed',
  bad: '#e5484d',
  amber: '#f5a524',
  good: '#12a06b',
  idle: '#d5dbe4',
  budget: '#d8d4cc',
  ink: '#1c1b19',
  mute: '#8a867e',
}

const CHIP: Record<CostTone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600',
}

const BANNER: Record<CostTone, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  bad: 'border-rose-200 bg-rose-50 text-rose-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
}

const CPI_LABEL: Record<CostTone, string> = { good: 'سالم', warn: 'نیازمند توجه', bad: 'بحرانی', neutral: '' }
const TCPI_LABEL: Record<CostTone, string> = {
  neutral: 'نیاز به بهبود ندارد',
  warn: 'نیازمند تلاش',
  bad: 'دور از دسترس',
  good: '',
}

const GAUGE_MAX = 1.5
const CPI_BANDS: Array<[number, number, string]> = [
  [0, CPI_ZONES.critical, COLOR.bad],
  [CPI_ZONES.critical, CPI_ZONES.healthy, COLOR.amber],
  [CPI_ZONES.healthy, GAUGE_MAX, COLOR.good],
]
const TCPI_BANDS: Array<[number, number, string]> = [
  [0, TCPI_ZONES.reachable, COLOR.idle],
  [TCPI_ZONES.reachable, TCPI_ZONES.stretch, COLOR.amber],
  [TCPI_ZONES.stretch, GAUGE_MAX, COLOR.bad],
]

const pct = (value: number) => `${faNumber(Math.round(value))}٪`

function Gauge({ value, bands, label }: { value: number | null; bands: Array<[number, number, string]>; label: string }) {
  const cx = 150
  const cy = 150
  const R = 108
  const point = (v: number, r: number): [number, number] => {
    const t = Math.PI * (1 - Math.min(Math.max(v, 0), GAUGE_MAX) / GAUGE_MAX)
    return [cx + r * Math.cos(t), cy - r * Math.sin(t)]
  }
  const [m1x, m1y] = point(1, R - 16)
  const [m2x, m2y] = point(1, R + 16)
  const tip = value == null ? null : point(value, R - 10)
  return (
    <svg viewBox="0 0 300 190" role="img" aria-label={label} className="mx-auto block h-auto w-full max-w-[340px]">
      {bands.map(([from, to, color]) => {
        const [ax, ay] = point(from, R)
        const [bx, by] = point(to, R)
        return (
          <path
            key={from}
            d={`M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}`}
            fill="none"
            stroke={value == null ? COLOR.idle : color}
            strokeWidth={22}
          />
        )
      })}
      <line x1={m1x} y1={m1y} x2={m2x} y2={m2y} stroke={COLOR.ink} strokeWidth={2.2} />
      {[0.5, 1].map((v) => {
        const [x, y] = point(v, R + 26)
        return (
          <text key={v} x={x} y={y + 3} textAnchor="middle" fontSize={10.5} fill={COLOR.mute}>
            {faNumber(v, 1)}
          </text>
        )
      })}
      <text x={cx - R} y={cy + 22} textAnchor="middle" fontSize={10.5} fill={COLOR.mute}>
        {faNumber(0)}
      </text>
      <text x={cx + R} y={cy + 22} textAnchor="middle" fontSize={10.5} fill={COLOR.mute}>
        {faNumber(GAUGE_MAX, 1)}
      </text>
      {tip ? (
        <>
          <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke={COLOR.ink} strokeWidth={4} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={9} fill={COLOR.ink} />
          <circle cx={cx} cy={cy} r={3} fill="#fff" />
        </>
      ) : null}
    </svg>
  )
}

function GaugeCard({
  title,
  subtitle,
  chip,
  gauge,
  big,
  bigColor,
  sentence,
  formula,
}: {
  title: string
  subtitle: string
  chip: { tone: CostTone; label: string }
  gauge: ReactNode
  big: string
  bigColor: string
  sentence: string
  formula: string
}) {
  return (
    <div className="rounded-2xl border border-[#1e2a5e]/45 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-6 text-slate-500">{subtitle}</p>
        </div>
        <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold', CHIP[chip.tone])}>{chip.label}</span>
      </div>
      <div className="mt-1.5">{gauge}</div>
      <p className="-mt-1 text-center text-[42px] font-extrabold leading-none tabular-nums" style={{ color: bigColor }}>
        {big}
      </p>
      <p className="mt-2.5 min-h-[46px] text-center text-[12.5px] leading-7 text-slate-700">{sentence}</p>
      <p className="mt-1.5 text-center text-[11px] text-slate-500" dir="ltr">
        {formula}
      </p>
    </div>
  )
}

function BarRow({ label, sub, budgetAt, children }: { label: string; sub: ReactNode; budgetAt: number; children?: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-[150px_1fr] items-center gap-3">
      <div className="text-xs font-semibold leading-5 text-slate-800">
        {label}
        <small className="block text-[11px] font-medium text-slate-500">{sub}</small>
      </div>
      <div className="relative h-[22px] rounded-[7px] bg-[#f0eeea]">
        {children}
        <span
          aria-hidden
          className="absolute -bottom-1 -top-1 w-0 border-s-2 border-dashed border-slate-900/50"
          style={{ insetInlineStart: `${budgetAt}%` }}
        />
      </div>
    </div>
  )
}

function Bar({ from = 0, width, color, className }: { from?: number; width: number; color?: string; className?: string }) {
  return (
    <i
      className={cn('absolute inset-y-0 rounded-[7px]', className)}
      style={{ insetInlineStart: `${from}%`, width: `${Math.max(width, 0)}%`, background: color }}
    />
  )
}

function Tile({ label, value, sub, color, title }: { label: string; value: string; sub: string; color?: string; title: string }) {
  return (
    <div title={title} className="rounded-xl border border-slate-100 bg-[#faf9f7] px-3 py-2">
      <span className="block text-[11px] text-slate-500">{label}</span>
      <b className="mt-px block text-[17px] tabular-nums" style={color ? { color } : undefined}>
        {value}
      </b>
      <small className="text-[10.5px] text-slate-500">{sub}</small>
    </div>
  )
}

function CostPerformanceBody({ evm, costHref }: { evm: ManagerEvmSummary; costHref?: string }) {
  const model = buildCostPerformance({ bac: evm.bac, ev: evm.evAmount, ac: evm.ac, budgetBasis: evm.budgetBasis })

  if (model.status === 'no_budget') {
    return (
      <EmptyNote
        title="بودجهٔ پروژه (BAC) تعریف نشده است"
        description="ستون هزینهٔ برنامهٔ دفتر فنی، مبلغ قرارداد یا بودجهٔ پروژه را ثبت کنید تا CPI و TCPI محاسبه شوند."
      />
    )
  }

  const ready: CostPerformanceReady | null = model.status === 'ok' ? model : null
  const scale = moneyScale(Math.max(model.bac, ready?.eac ?? 0, ready?.ac ?? 0))
  const n = (v: number) => {
    const text = faNumber(Math.abs(v) / scale.divisor, 1)
    return v < 0 ? `−${text}` : text
  }
  const unit = scale.unit
  const span = Math.max(model.bac, ready?.eac ?? 0, ready?.ac ?? 0) * 1.1
  const w = (v: number) => (v / span) * 100
  const budgetAt = w(model.bac)

  const cpiValue = ready?.cpi ?? null
  const tcpiValue = ready ? ready.tcpi : null
  const missing = 'ثبت نشده'

  let banner: { tone: CostTone; text: string }
  if (!ready) {
    banner = {
      tone: 'warn',
      text: 'هزینهٔ واقعی (AC) هنوز برای این پروژه ثبت نشده است؛ CPI، TCPI و پیش‌بینی هزینهٔ نهایی پس از ثبت هزینه محاسبه می‌شوند.',
    }
  } else if (ready.eac == null || ready.vac == null || ready.overrunPercent == null) {
    banner = { tone: 'bad', text: 'هزینه ثبت شده ولی هنوز ارزش کسب‌شده‌ای وجود ندارد؛ پیش‌بینی هزینهٔ نهایی ممکن نیست.' }
  } else if (ready.vac >= 0) {
    banner = { tone: 'good', text: `با روند فعلی، پروژه در بودجه تمام می‌شود (هزینهٔ نهایی پیش‌بینی‌شده ${n(ready.eac)} ${unit}).` }
  } else {
    banner = {
      tone: ready.bannerTone,
      text: `با روند فعلی، هزینهٔ نهایی پروژه ${n(ready.eac)} ${unit} می‌شود: ${n(-ready.vac)} ${unit} (${pct(ready.overrunPercent)}) بیش از بودجه.`,
    }
  }

  const tcpiSentence = !ready
    ? 'با ثبت هزینهٔ واقعی، کارایی لازم برای ماندن در بودجه نمایش داده می‌شود.'
    : ready.tcpi == null
      ? 'بودجهٔ مصوب تمام شده در حالی که هنوز کار باقی مانده است؛ تکمیل در سقف بودجه ممکن نیست.'
      : ready.tcpi <= TCPI_ZONES.reachable
        ? 'با همین سطح کارایی هم به بودجه می‌رسیم.'
        : `برای رسیدن به بودجه، از امروز باید به‌ازای هر 100 واحد هزینه، ${faNumber(Math.round(ready.tcpi * 100))} واحد کار انجام شود. تا امروز ${faNumber(Math.round(ready.cpi * 100))} بوده است.`

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          همهٔ شاخص‌ها از سه عدد بودجه (BAC)، هزینهٔ واقعی (AC) و ارزش کار انجام‌شده (EV) محاسبه می‌شوند
        </p>
        <span className="rounded-full border border-slate-200 bg-white px-3.5 py-1 text-[11.5px] text-slate-500">
          آخرین به‌روزرسانی: {jalaliDate(evm.asOf)}
        </span>
      </div>

      <div role="status" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-[13px] font-semibold leading-7', BANNER[banner.tone])}>
        <span>{banner.text}</span>
        {!ready && costHref ? (
          <Link
            href={costHref}
            className="inline-flex items-center gap-1 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            ثبت هزینه
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <GaugeCard
          title="CPI · کارایی هزینه"
          subtitle="تا امروز، به‌ازای هر هزینه چقدر کار انجام شده"
          chip={ready ? { tone: ready.cpiTone, label: CPI_LABEL[ready.cpiTone] } : { tone: 'neutral', label: 'بدون داده' }}
          gauge={<Gauge value={cpiValue} bands={CPI_BANDS} label="گیج CPI" />}
          big={cpiValue == null ? '—' : faNumber(cpiValue, 2)}
          bigColor={cpiValue == null ? COLOR.mute : COLOR.ac}
          sentence={
            ready
              ? `به‌ازای هر 100 واحد هزینه، ${faNumber(Math.round(ready.cpi * 100))} واحد کار انجام شده است.`
              : 'با ثبت هزینهٔ واقعی، کارایی هزینه نمایش داده می‌شود.'
          }
          formula={ready ? `CPI = EV ÷ AC = ${n(ready.ev)} ÷ ${n(ready.ac)}` : 'CPI = EV ÷ AC'}
        />
        <GaugeCard
          title="TCPI · کارایی لازم"
          subtitle="برای رسیدن به بودجه، از امروز چقدر باید کارآمد باشیم"
          chip={ready ? { tone: ready.tcpiTone, label: TCPI_LABEL[ready.tcpiTone] } : { tone: 'neutral', label: 'بدون داده' }}
          gauge={<Gauge value={ready ? (tcpiValue ?? GAUGE_MAX) : null} bands={TCPI_BANDS} label="گیج TCPI" />}
          big={!ready ? '—' : tcpiValue == null ? '∞' : faNumber(tcpiValue, 2)}
          bigColor={!ready ? COLOR.mute : '#3b4a63'}
          sentence={tcpiSentence}
          formula={
            ready
              ? `TCPI = (BAC − EV) ÷ (BAC − AC) = ${n(ready.bac - ready.ev)} ÷ ${n(ready.remainingBudget)}`
              : 'TCPI = (BAC − EV) ÷ (BAC − AC)'
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.45fr_1fr]">
        <div className="rounded-2xl border border-[#1e2a5e]/45 bg-white px-5 py-4">
          <p className="text-sm font-bold text-slate-800">بودجه، هزینه و کار انجام‌شده</p>
          <p className="mb-3.5 mt-0.5 text-[11.5px] text-slate-500">همهٔ میله‌ها روی یک مقیاس‌اند ({unit}). خط‌چین، سقف بودجه است.</p>
          <div className="pt-3.5">
            <BarRow label="بودجه کل (BAC)" sub={`${n(model.bac)} ${unit}`} budgetAt={budgetAt}>
              <Bar width={w(model.bac)} color={COLOR.budget} />
              <em
                className="absolute -top-[17px] translate-x-1/2 text-[9.5px] not-italic text-slate-500"
                style={{ insetInlineStart: `${budgetAt}%` }}
              >
                بودجه
              </em>
            </BarRow>
            <BarRow
              label="هزینه‌شده (AC)"
              sub={ready ? `${n(ready.ac)} ${unit} · ${pct(ready.acPercent)} بودجه` : missing}
              budgetAt={budgetAt}
            >
              {ready ? <Bar width={w(ready.ac)} color={COLOR.ac} /> : null}
            </BarRow>
            <BarRow label="کار انجام‌شده (EV)" sub={`${n(model.ev)} ${unit} · ${pct(model.evPercent)} پیشرفت ارزشی`} budgetAt={budgetAt}>
              <Bar width={w(model.ev)} color={COLOR.ev} />
            </BarRow>
            <BarRow
              label="اختلاف هزینه و کار"
              sub={
                ready ? (
                  <span className={ready.cv < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {n(ready.cv)} {unit}
                  </span>
                ) : (
                  missing
                )
              }
              budgetAt={budgetAt}
            >
              {ready && ready.cv < 0 ? <Bar from={w(ready.ev)} width={w(ready.ac - ready.ev)} color={COLOR.bad} className="rounded-[3px]" /> : null}
            </BarRow>
            <BarRow
              label="پیش‌بینی هزینهٔ نهایی (EAC)"
              sub={ready?.eac != null ? `${n(ready.eac)} ${unit} · با روند فعلی` : missing}
              budgetAt={budgetAt}
            >
              {ready?.eac != null ? (
                <>
                  <Bar
                    width={w(Math.min(model.bac, ready.eac))}
                    className="bg-[repeating-linear-gradient(135deg,#e6e3dc_0_5px,#f3f1ec_5px_10px)]"
                  />
                  {ready.eac > model.bac ? <Bar from={budgetAt} width={w(ready.eac - model.bac)} color={COLOR.bad} /> : null}
                </>
              ) : null}
            </BarRow>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1e2a5e]/45 bg-white px-5 py-4">
          <p className="text-sm font-bold text-slate-800">اعداد کلیدی</p>
          <p className="mb-3.5 mt-0.5 text-[11.5px] text-slate-500">{unit}</p>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="بودجه کل (BAC)" value={n(model.bac)} sub="سقف هزینهٔ پروژه" title="بودجهٔ مصوب پروژه" />
            <Tile
              label="هزینه‌شده (AC)"
              value={ready ? n(ready.ac) : '—'}
              sub={ready ? `${pct(ready.acPercent)} بودجه` : missing}
              color={ready ? COLOR.ac : undefined}
              title="هزینهٔ واقعی تا امروز"
            />
            <Tile
              label="مانده بودجه"
              value={ready ? n(ready.remainingBudget) : '—'}
              sub={ready ? `${pct((ready.remainingBudget / ready.bac) * 100)} بودجه` : missing}
              title="BAC − AC"
            />
            <Tile label="کار انجام‌شده (EV)" value={n(model.ev)} sub={`${pct(model.evPercent)} پیشرفت ارزشی`} color={COLOR.ev} title="ارزش کار انجام‌شده تا امروز" />
            <Tile
              label="کار باقی‌مانده"
              value={n(model.remainingWork)}
              sub={`${pct((model.remainingWork / model.bac) * 100)} کار`}
              title="BAC − EV"
            />
            <Tile
              label="انحراف هزینه (CV)"
              value={ready ? n(ready.cv) : '—'}
              sub={ready ? (ready.cv < 0 ? 'هزینه بیش از کار انجام‌شده' : 'صرفه‌جویی') : missing}
              color={ready ? (ready.cv < 0 ? '#b42327' : '#0b7a50') : undefined}
              title="CV = EV − AC"
            />
            <Tile
              label="هزینهٔ نهایی (EAC)"
              value={ready?.eac != null ? n(ready.eac) : '—'}
              sub={ready?.eac != null ? 'با روند فعلی' : missing}
              title="EAC = BAC ÷ CPI"
            />
            <Tile
              label="انحراف در پایان (VAC)"
              value={ready?.vac != null ? n(ready.vac) : '—'}
              sub={
                ready?.vac != null && ready.overrunPercent != null
                  ? ready.vac < 0
                    ? `${pct(ready.overrunPercent)} بیش از بودجه`
                    : 'در بودجه'
                  : missing
              }
              color={ready?.vac != null ? (ready.vac < 0 ? '#b42327' : '#0b7a50') : undefined}
              title="VAC = BAC − EAC"
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        CPI = EV ÷ AC، TCPI = (BAC − EV) ÷ (BAC − AC)، EAC = BAC ÷ CPI (پیش‌بینی هزینهٔ نهایی با روند فعلی). EV ریالی = Σ(بودجهٔ فعالیت × پیشرفت فیزیکی تأییدشده).
      </p>
    </div>
  )
}

export function CostPerformanceSection({
  result,
  loading,
  costHref,
  className,
}: {
  result: SectionResult<ManagerEvmSummary> | undefined
  loading: boolean
  costHref?: string
  className?: string
}) {
  return (
    <SectionCard
      className={cn('border-2 border-[#1e2a5e] bg-[#fdf8ec]', className)}
      title="وضعیت مالی و کارایی هزینهٔ پروژه"
      icon={<Wallet className="h-4 w-4" aria-hidden />}
      hint="CPI نشان می‌دهد تا امروز به‌ازای هر واحد هزینه چقدر کار انجام شده؛ TCPI نشان می‌دهد از امروز چقدر باید کارآمد باشیم تا در سقف بودجه تمام شود. اعداد از بودجهٔ برنامهٔ دفتر فنی، هزینه‌های ثبت‌شده و پیشرفت تأییدشدهٔ پروژه می‌آیند."
    >
      <SectionBody result={result} loading={loading} rows={6}>
        {(evm) => <CostPerformanceBody evm={evm} costHref={costHref} />}
      </SectionBody>
    </SectionCard>
  )
}
