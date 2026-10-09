'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, BookOpen, Calculator, CalendarClock, HardHat, Layers, Sigma } from 'lucide-react'
import type { ProjectEvmActivityRow, ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import type { ManagerOverview } from '@/features/manager/lib/overview-types'
import { compactToman, faNumber, faPercent, jalaliDate, jalaliDateTime } from '@/features/manager/lib/format'
import { readProjectDailyProgress } from '@/features/supervisor/lib/daily-progress-storage'
import {
buildDailyReportActivitiesFromTree,
buildSCurveActivitiesFromTree,
calculateSCurveActualProgress,
progressForSCurveAsOf,
type DailyProgressEntry,
type DailyReportActivity,
} from '@/features/supervisor/lib/daily-report-activities'
import type { ScheduleTreeNode, WorkshopPackageNode } from '@/features/workshop/lib/types'
import { todayTehranIso } from '@/shared/lib/time/tehran'
import { resolveSiblingWeights, type WeightIssue } from '@/features/schedule/lib/weight-consistency'
import type { EarnedScheduleSolution } from '@/features/project-controls/lib/earned-schedule'
import type { ExplainedKpi } from '@/shared/types/project-controls'
import { DATA_QUALITY_FA, KPI_STATUS_TOKENS } from '@/features/project-controls/lib/explained-metric'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import type { WeeklyPlanLoad } from '@/features/project-controls/lib/load-weekly-plan'
import { buildEarnedScheduleKpis, buildPpcKpi, buildTcpiKpi, type EarnedScheduleKpiKey } from '@/features/project-controls/lib/kpis'
import { EmptyNote, LoadingRows, SectionCard } from './manager-ui'
import { Frac, MathBlock, MathLine, Num, Op, Sum, V } from './math-formula'

type Load<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; message: string }

function useJson<T>(url: string | null): Load<T> {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' })
  useEffect(() => {
    if (!url) return
    let cancelled = false
    setResult({ state: 'loading' })
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (cancelled) return
        if (!response.ok || body?.error) {
          setResult({ state: 'error', message: body?.error ?? `خطای ${response.status}` })
        } else {
          setResult({ state: 'ok', data: body as T })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ state: 'error', message: error instanceof Error ? error.message : 'خطای شبکه' })
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return result
}

const BASIS_LABEL: Record<string, string> = {
  technical_office_cost: 'ستون «هزینه» برنامهٔ دفتر فنی؛ BAC = جمع هزینهٔ فعالیت‌های برگ',
  contract_value: 'مبلغ قرارداد (BAC) به نسبت وزن فعالیت‌ها پخش شده',
  weighted_project_budget: 'بودجهٔ پروژه به نسبت وزن فعالیت‌ها پخش شده',
  none: 'بودجه ثبت نشده — PV و EV بر مبنای وزن',
}

function n(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : faNumber(value, digits)
}

/** Latin digits for formula substitutions, which read left to right. */
function lat(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function WeightedAverage({ value, weight, label }: { value: ReactNode; weight: ReactNode; label: ReactNode }) {
  return (
    <>
      {label}
      <Op>=</Op>
      <Frac
        num={
          <Sum>
            {weight}
            <Op>×</Op>
            {value}
          </Sum>
        }
        den={<Sum>{weight}</Sum>}
      />
    </>
  )
}

function Result({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-base font-bold tabular-nums text-slate-900">{value}</p>
      {note ? <p className="text-[11px] text-slate-500">{note}</p> : null}
    </div>
  )
}

function Table({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-2.5 py-2 text-right font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums text-slate-800">
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((cell, j) => (
                <td key={j} className="px-2.5 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot ? (
          <tfoot className="bg-slate-50 font-semibold tabular-nums text-slate-900">
            <tr>
              {foot.map((cell, j) => (
                <td key={j} className="px-2.5 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}

function StateNote({ load }: { load: Load<unknown> }) {
  if (load.state === 'loading') return <LoadingRows rows={4} />
  if (load.state === 'error') return <EmptyNote tone="error" title="داده بارگذاری نشد" description={load.message} />
  return null
}

function activityLabel(a: { wbs: string | null; name: string; kind?: string }) {
  return (
    <span>
      {a.wbs ? <span className="text-slate-500">{a.wbs} · </span> : null}
      {a.name}
      {a.kind === 'package' ? <span className="mr-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">بسته</span> : null}
    </span>
  )
}

/* ------------------------------------------------------------- Conventions */

function ConventionsCard() {
  const items: [string, string][] = [
    ['منبع درصد رسمی', 'درصد پیشرفت فیزیکی ذخیره‌شده در برنامهٔ زمان‌بندی (project_tasks و schedule_fields بسته‌ها).'],
    ['برنامه (PV)', 'همیشه از baseline منجمد؛ اگر baseline خالی باشد تاریخ برنامه‌ریزی‌شده. تاریخ‌های جاری در برنامه دخالت ندارند.'],
    ['شمارش روز', 'روز تقویمی، هر دو سر بازه شمرده می‌شود: روز اول بازهٔ 10 روزه = 10٪، روز پایان = 100٪. قبل از شروع 0 و بعد از پایان 100.'],
    ['منطقهٔ زمانی', 'Asia/Tehran (UTC+03:30) برای «امروز»، شروع هفته (شنبه) و ماه شمسی.'],
    ['وزن پیشرفت', 'وزن زمان‌بندی (schedule_weight) هر فعالیت برگ؛ جمع وزن‌ها مخرج میانگین است. پیشرفت تجمعی، PV٪، EV٪ و SPI همه روی همین مبنا هستند؛ بودجه فقط برای هزینه (CPI و TCPI).'],
    ['وزن بسته‌ها', 'وزن بسته مطلق است (درصد کل پروژه) و جمع بسته‌های هر والد باید با وزن والد برابر باشد؛ مغایرت به وزن والد مقیاس و در Data Quality ثبت می‌شود.'],
    ['گرد کردن', 'محاسبات بدون گرد کردن انجام می‌شود؛ فقط هنگام نمایش گرد می‌شود.'],
  ]
  return (
    <SectionCard title="قراردادهای محاسبه" icon={<BookOpen className="h-4 w-4" aria-hidden />}>
      <dl className="grid gap-2 sm:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-200">
            <dt className="text-xs font-semibold text-slate-800">{k}</dt>
            <dd className="mt-0.5 text-xs leading-5 text-slate-600">{v}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}

/* ------------------------------------------------------- Cumulative progress */

function CumulativeCard({
  activities,
  cardValue,
  weightIssues,
}: {
  activities: ProjectEvmActivityRow[]
  cardValue: number | null
  weightIssues: WeightIssue[]
}) {
  const rows = activities.filter((a) => a.weight > 0)
  const totalWeight = rows.reduce((s, a) => s + a.weight, 0)
  const totalDone = rows.reduce((s, a) => s + a.weight * a.physicalPercent, 0)
  const result = totalWeight > 0 ? totalDone / totalWeight : null
  return (
    <SectionCard title="پیشرفت تجمعی (کارت مدیر)" icon={<Sigma className="h-4 w-4" aria-hidden />}>
      <div className="space-y-3">
        <MathBlock>
          <MathLine>
            <WeightedAverage label={<V>Progress</V>} weight={<V sub="i">w</V>} value={<V sub="i">p</V>} />
          </MathLine>
          {result != null ? (
            <MathLine>
              <V>Progress</V>
              <Op>=</Op>
              <Frac num={<Num>{lat(totalDone)}</Num>} den={<Num>{lat(totalWeight)}</Num>} />
              <Op>=</Op>
              <Num>{lat(result)}%</Num>
            </MathLine>
          ) : null}
          <p dir="rtl" className="font-sans text-[11px] text-slate-500">w = وزن زمان‌بندی فعالیت · p = درصد پیشرفت فیزیکی</p>
        </MathBlock>
        <Table
          head={['فعالیت', 'وزن', 'درصد فیزیکی', 'وزن × درصد']}
          rows={rows.map((a) => [activityLabel(a), n(a.weight), faPercent(a.physicalPercent, 1), n(a.weight * a.physicalPercent)])}
          foot={['جمع', n(totalWeight), '', n(totalDone)]}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <Result label="محاسبه" value={`${n(totalDone)} ÷ ${n(totalWeight)}`} />
          <Result label="نتیجه" value={result == null ? '—' : faPercent(result, 2)} />
          <Result label="عدد کارت داشبورد" value={cardValue == null ? '—' : faPercent(cardValue, 2)} />
        </div>
        {weightIssues.length > 0 ? (
          weightIssues.map((issue) => (
            <p key={`${issue.code}:${issue.parentId ?? ''}`} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              خطای کیفیت داده{issue.parentLabel ? ` («${issue.parentLabel}»)` : ''}: {issue.message_fa}
            </p>
          ))
        ) : (
          <p className="text-xs text-emerald-700">اعتبارسنجی وزن‌ها: جمع وزن بسته‌های هر والد با وزن والد و جمع کل برگ‌ها با 100 برابر است.</p>
        )}
      </div>
    </SectionCard>
  )
}

/* ---------------------------------------------------------------- PV / EV */

function EvmCard({ snapshot }: { snapshot: ProjectEvmSnapshot }) {
  const m = snapshot.metrics
  const byWeight = m.progressBasis === 'schedule_weight'
  const weightOf = (a: ProjectEvmSnapshot['activities'][number]) => (byWeight ? a.weight : a.budget)
  const rows = snapshot.activities.filter((a) => weightOf(a) > 0)
  const sumPlanned = rows.reduce((s, a) => s + weightOf(a) * a.plannedPercent, 0) / 100
  const sumEarned = rows.reduce((s, a) => s + weightOf(a) * a.physicalPercent, 0) / 100
  const W = byWeight ? 'w' : 'Budget'
  return (
    <SectionCard title="PV، EV و SPI" icon={<Calculator className="h-4 w-4" aria-hidden />}>
      <div className="space-y-3">
        <p className="text-xs text-slate-600">
          مبنای پیشرفت: {byWeight ? 'وزن زمان‌بندی (MSP)' : 'بودجه (هیچ فعالیتی وزن ندارد)'} · مبنای بودجه برای هزینه:{' '}
          {BASIS_LABEL[m.budgetBasis] ?? m.budgetBasis} · تاریخ محاسبه {jalaliDate(m.asOf)}
        </p>
        <MathBlock>
          <MathLine>
            <V sub="i">Planned%</V>
            <Op>=</Op>
            <Frac num={<V>days(Start → asOf)</V>} den={<V>days(Start → Finish)</V>} />
            <Op>×</Op>
            <Num>100</Num>
          </MathLine>
          <MathLine>
            <V>PV%</V>
            <Op>=</Op>
            <Frac
              num={
                <Sum>
                  <V sub="i">{W}</V>
                  <Op>×</Op>
                  <V sub="i">Planned%</V>
                </Sum>
              }
              den={
                <Sum>
                  <V sub="i">{W}</V>
                </Sum>
              }
            />
            <Op>=</Op>
            <Frac num={<Num>{lat(sumPlanned, 2)}</Num>} den={<Num>{lat(m.totalWeight, 2)}</Num>} />
            <Op>=</Op>
            <Num>{lat(m.plannedPercent, 2)}%</Num>
          </MathLine>
          <MathLine>
            <V>EV%</V>
            <Op>=</Op>
            <Frac
              num={
                <Sum>
                  <V sub="i">{W}</V>
                  <Op>×</Op>
                  <V sub="i">Physical%</V>
                </Sum>
              }
              den={
                <Sum>
                  <V sub="i">{W}</V>
                </Sum>
              }
            />
            <Op>=</Op>
            <Frac num={<Num>{lat(sumEarned, 2)}</Num>} den={<Num>{lat(m.totalWeight, 2)}</Num>} />
            <Op>=</Op>
            <Num>{lat(m.earnedPercent, 2)}%</Num>
          </MathLine>
          <MathLine>
            <V>SPI</V>
            <Op>=</Op>
            <Frac num={<V>EV%</V>} den={<V>PV%</V>} />
            <Op>=</Op>
            <Frac num={<Num>{lat(m.earnedPercent, 2)}</Num>} den={<Num>{lat(m.plannedPercent, 2)}</Num>} />
            <Op>=</Op>
            <Num>{lat(m.spi, 3)}</Num>
          </MathLine>
          <MathLine>
            <V sub="cost">EV</V>
            <Op>=</Op>
            <Sum>
              <V sub="i">Budget</V>
              <Op>×</Op>
              <V sub="i">Physical%</V>
            </Sum>
            <span className="w-6" />
            <V>CPI</V>
            <Op>=</Op>
            <Frac num={<V sub="cost">EV</V>} den={<V>AC</V>} />
            {m.cpi != null ? (
              <>
                <Op>=</Op>
                <Num>{lat(m.cpi, 3)}</Num>
              </>
            ) : null}
          </MathLine>
          <p dir="rtl" className="font-sans text-[11px] text-slate-500">
            SPI و پیشرفت تجمعی هر دو با وزن زمان‌بندی نرمال‌شده محاسبه می‌شوند؛ بودجه فقط برای هزینه (CPI و TCPI) به کار می‌رود · روزها با هر دو سر بازه شمرده می‌شوند · Start و Finish تاریخ‌های baseline هستند
          </p>
        </MathBlock>
        <Table
          head={['فعالیت', byWeight ? 'وزن' : 'بودجه', 'شروع مبنا', 'پایان مبنا', 'برنامه٪', 'وزن × برنامه٪', 'فیزیکی٪', 'وزن × فیزیکی٪', 'بودجه']}
          rows={rows.map((a) => [
            activityLabel(a),
            n(weightOf(a), 2),
            jalaliDate(a.baselineStart),
            jalaliDate(a.baselineFinish),
            faPercent(a.plannedPercent, 1),
            n((weightOf(a) * a.plannedPercent) / 100, 3),
            faPercent(a.physicalPercent, 1),
            n((weightOf(a) * a.physicalPercent) / 100, 3),
            a.budget > 0 ? n(a.budget) : '—',
          ])}
          foot={['جمع', n(m.totalWeight, 2), '', '', '', n(sumPlanned, 3), '', n(sumEarned, 3), m.bac > 0 ? n(m.bac) : '—']}
        />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Result label="PV٪ (برنامه)" value={faPercent(m.plannedPercent, 2)} />
          <Result label="EV٪ (کسب‌شده)" value={faPercent(m.earnedPercent, 2)} />
          <Result label="SPI = EV٪ ÷ PV٪" value={n(m.spi, 3)} />
          <Result label="BAC" value={m.bac > 0 ? n(m.bac) : 'ثبت نشده'} />
          <Result label="AC (هزینهٔ واقعی)" value={m.ac > 0 ? compactToman(m.ac) : 'ثبت نشده'} />
          <Result label="CPI = EV ریالی ÷ AC" value={m.cpi == null ? 'ثبت نشده' : n(m.cpi, 3)} />
        </div>
      </div>
    </SectionCard>
  )
}

/* -------------------------------------------------------------- Forecast */

function ForecastCard({ overview }: { overview: ManagerOverview }) {
  const evm = overview.evm.status === 'ok' ? overview.evm.data : null
  const f = evm?.scheduleForecast ?? null
  return (
    <SectionCard title="تأخیر و پیش‌بینی پایان" icon={<CalendarClock className="h-4 w-4" aria-hidden />}>
      {evm ? (
        <div className="space-y-3">
          <MathBlock>
            <MathLine>
              <V>Lag</V>
              <Op>=</Op>
              <V>AT</V>
              <Op>−</Op>
              <V>ES</V>
              {f ? (
                <>
                  <Op>=</Op>
                  <Num>{lat(f.actualTimeDays, 0)}</Num>
                  <Op>−</Op>
                  <Num>{lat(f.earnedScheduleDays, 2)}</Num>
                  <Op>≈</Op>
                  <Num>{f.varianceDays} days</Num>
                </>
              ) : null}
            </MathLine>
            <MathLine>
              <V sub="optimistic">Finish</V>
              <Op>=</Op>
              <V>Baseline Finish</V>
              <Op>+</Op>
              <V>Lag</V>
            </MathLine>
            <MathLine>
              <V sub="trend">Finish</V>
              <Op>=</Op>
              <V>Today</V>
              <Op>+</Op>
              <Frac
                num={
                  <>
                    <V>PD</V>
                    <Op>−</Op>
                    <V>ES</V>
                  </>
                }
                den={<V>SPI(t)</V>}
              />
              {f && f.spiT != null ? (
                <>
                  <Op>=</Op>
                  <V>Today</V>
                  <Op>+</Op>
                  <Frac
                    num={
                      <>
                        <Num>{lat(f.plannedDurationDays, 0)}</Num>
                        <Op>−</Op>
                        <Num>{lat(f.earnedScheduleDays, 2)}</Num>
                      </>
                    }
                    den={<Num>{lat(f.spiT, 3)}</Num>}
                  />
                </>
              ) : null}
            </MathLine>
            <p dir="rtl" className="font-sans text-[11px] text-slate-500">
              AT روزهای سپری‌شده از شروع مبنا و ES روزی است که منحنی PV وزنی مبنا به EV٪ امروز می‌رسید؛ پیش‌بینی اول فرض می‌کند باقی کار با سرعت برنامه پیش برود و دومی با سرعت واقعی تاکنون (SPI(t))
            </p>
          </MathBlock>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Result label="EV٪ امروز" value={faPercent(evm.earnedPercent, 2)} />
            <Result label="عقب‌افتادگی (روز)" value={evm.scheduleVarianceDays == null ? '—' : faNumber(evm.scheduleVarianceDays)} />
            <Result label="SPI(t) = ES ÷ AT" value={n(f?.spiT, 3)} />
            <Result label="پایان برنامهٔ مبنا" value={jalaliDate(f?.plannedFinish)} />
            <Result label="پیش‌بینی پایان (با فرض سرعت برنامه)" value={jalaliDate(f?.forecastFinish)} />
            <Result label="پیش‌بینی پایان (با روند فعلی)" value={f?.trendFinish ? jalaliDate(f.trendFinish) : '—'} />
          </div>
          {f ? <p className="text-xs text-slate-500">شروع برنامهٔ مبنا: {jalaliDate(f.start)}</p> : null}
          {f?.planPeriodEnded ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
              دورهٔ برنامه تمام شده؛ بازنگری مبنا (re-baseline) را بررسی کنید
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyNote title="شاخص EVM در دسترس نیست" />
      )}
    </SectionCard>
  )
}

/* --------------------------------------------------------- Earned schedule */

function earnedScheduleMath(key: EarnedScheduleKpiKey, kpis: Record<EarnedScheduleKpiKey, ExplainedKpi>, pd: number): ReactNode {
  const { at, es, spi_t, sv_t, eac_t, delay_forecast } = kpis
  const atDebug = (at.debug ?? {}) as { start?: string; status?: string; elapsedDays?: number; daysPerUnit?: number }
  const dpu = atDebug.daysPerUnit ?? 1
  switch (key) {
    case 'at':
      return (
        <>
          <MathLine>
            <V>AT</V>
            <Op>=</Op>
            <Frac num={<V>Status Date − Start Date</V>} den={<V>Days per Period</V>} />
          </MathLine>
          <MathLine>
            <V>AT</V>
            <Op>=</Op>
            <Frac num={<Num>{atDebug.status} − {atDebug.start}</Num>} den={<Num>{dpu}</Num>} />
            <Op>=</Op>
            <Frac num={<Num>{atDebug.elapsedDays}</Num>} den={<Num>{dpu}</Num>} />
            <Op>=</Op>
            <Num>{lat(at.value)}</Num>
          </MathLine>
        </>
      )
    case 'es': {
      const sol = (es.debug ?? {}) as Partial<EarnedScheduleSolution> & { ev?: number }
      return (
        <>
          <MathLine>
            <V>ES</V>
            <Op>=</Op>
            <V>C</V>
            <Op>+</Op>
            <V>I</V>
            <span className="w-4" />
            <V>I</V>
            <Op>=</Op>
            <Frac
              num={
                <>
                  <V>EV</V>
                  <Op>−</Op>
                  <V sub="C">PV</V>
                </>
              }
              den={
                <>
                  <V sub="C+1">PV</V>
                  <Op>−</Op>
                  <V sub="C">PV</V>
                </>
              }
            />
          </MathLine>
          {sol.rule === 'interpolated' && sol.c && sol.next ? (
            <>
              <MathLine>
                <V sub="C">PV</V>
                <Op>=</Op>
                <Num>{lat(sol.c.pv)}</Num>
                <Op>≤</Op>
                <V>EV</V>
                <Op>=</Op>
                <Num>{lat(sol.ev)}</Num>
                <Op>&lt;</Op>
                <V sub="C+1">PV</V>
                <Op>=</Op>
                <Num>{lat(sol.next.pv)}</Num>
              </MathLine>
              <MathLine>
                <V>I</V>
                <Op>=</Op>
                <Frac
                  num={<Num>{lat(sol.ev)} − {lat(sol.c.pv)}</Num>}
                  den={<Num>{lat(sol.next.pv)} − {lat(sol.c.pv)}</Num>}
                />
                <Op>=</Op>
                <Num>{lat(sol.fraction, 4)}</Num>
                <span className="w-4" />
                <V>ES</V>
                <Op>=</Op>
                <Num>{lat(sol.c.periodIndex)}</Num>
                <Op>+</Op>
                <Num>{lat(sol.fraction, 4)}</Num>
                <Op>=</Op>
                <Num>{lat(es.value)}</Num>
              </MathLine>
            </>
          ) : (
            <MathLine>
              <span className="font-sans text-xs not-italic">{es.substitution}</span>
            </MathLine>
          )}
        </>
      )
    }
    case 'spi_t':
      return (
        <>
          <MathLine>
            <V>SPI(t)</V>
            <Op>=</Op>
            <Frac num={<V>ES</V>} den={<V>AT</V>} />
            <Op>=</Op>
            <Frac num={<Num>{lat(es.value)}</Num>} den={<Num>{lat(at.value)}</Num>} />
            <Op>=</Op>
            <Num>{spi_t.value == null ? 'undefined' : lat(spi_t.value, 3)}</Num>
          </MathLine>
        </>
      )
    case 'sv_t':
      return (
        <MathLine>
          <V>SV(t)</V>
          <Op>=</Op>
          <V>ES</V>
          <Op>−</Op>
          <V>AT</V>
          <Op>=</Op>
          <Num>{lat(es.value)}</Num>
          <Op>−</Op>
          <Num>{lat(at.value)}</Num>
          <Op>=</Op>
          <Num>{lat(sv_t.value)}</Num>
        </MathLine>
      )
    case 'eac_t':
      return (
        <MathLine>
          <V>EAC(t)</V>
          <Op>=</Op>
          <Frac num={<V>PD</V>} den={<V>SPI(t)</V>} />
          {eac_t.value != null && spi_t.value != null ? (
            <>
              <Op>=</Op>
              <Frac num={<Num>{lat(pd)}</Num>} den={<Num>{lat(spi_t.value, 3)}</Num>} />
              <Op>=</Op>
              <Num>{lat(eac_t.value)}</Num>
            </>
          ) : (
            <span className="font-sans text-xs not-italic">— undefined (SPI(t) ≤ 0)</span>
          )}
        </MathLine>
      )
    case 'delay_forecast':
      return (
        <>
          <MathLine>
            <V>Delay</V>
            <Op>=</Op>
            <Op>(</Op>
            <V>EAC(t)</V>
            <Op>−</Op>
            <V>PD</V>
            <Op>)</Op>
            <Op>×</Op>
            <V>Days per Period</V>
          </MathLine>
          {delay_forecast.value != null && eac_t.value != null ? (
            <MathLine>
              <V>Delay</V>
              <Op>=</Op>
              <Op>(</Op>
              <Num>{lat(eac_t.value)}</Num>
              <Op>−</Op>
              <Num>{lat(pd)}</Num>
              <Op>)</Op>
              <Op>×</Op>
              <Num>{dpu}</Num>
              <Op>=</Op>
              <Num>{lat(delay_forecast.value, 0)} days</Num>
            </MathLine>
          ) : null}
        </>
      )
  }
}

function EarnedScheduleCard({ snapshot }: { snapshot: ProjectEvmSnapshot }) {
  const [unit, setUnit] = useState<'months' | 'weeks' | 'days'>('months')
  const { controls, kpis } = useMemo(() => {
    const controls = buildControlsSnapshot({ evm: snapshot, periodUnit: unit })
    return { controls, kpis: buildEarnedScheduleKpis(controls) }
  }, [snapshot, unit])
  const order: EarnedScheduleKpiKey[] = ['at', 'es', 'spi_t', 'sv_t', 'eac_t', 'delay_forecast']
  const headline = kpis.spi_t
  const headlineTokens = KPI_STATUS_TOKENS[headline.status]
  return (
    <SectionCard
      title="شاخص‌های زمان‌محور (Earned Schedule)"
      icon={<CalendarClock className="h-4 w-4" aria-hidden />}
      action={
        <div className="flex gap-1" role="group" aria-label="واحد دوره">
          {(['months', 'weeks', 'days'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={
                unit === u
                  ? 'rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white'
                  : 'rounded-full bg-white px-2.5 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }
            >
              {u === 'months' ? 'ماه' : u === 'weeks' ? 'هفته' : 'روز'}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        <div className={`rounded-xl border px-3 py-2 text-xs leading-6 ${headlineTokens.bg} ${headlineTokens.text} ${headlineTokens.border}`}>
          <span className="font-bold">{headline.data_quality === 'ok' ? headlineTokens.label_fa : DATA_QUALITY_FA[headline.data_quality]} · </span>
          {headline.interpretation_fa} {kpis.delay_forecast.data_quality === 'ok' ? kpis.delay_forecast.interpretation_fa : ''}
        </div>
        <p className="text-xs text-slate-600">
          ورودی‌ها: شروع مبنا {jalaliDate(controls.projectStart.value)} · پایان مبنا {jalaliDate(controls.baselineFinish.value)} · تاریخ وضعیت{' '}
          {jalaliDate(controls.asOf)} · EV = {n(controls.ev.value)} · نقاط منحنی {faNumber(controls.pvCurve.value?.length ?? 0)}
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {order.map((key) => (
            <KpiBlock
              key={key}
              kpi={kpis[key]}
              digits={key === 'spi_t' ? 3 : key === 'delay_forecast' ? 0 : 2}
              math={earnedScheduleMath(key, kpis, controls.plannedDuration.value ?? 0)}
            />
          ))}
        </div>
        <ul className="list-disc space-y-0.5 pr-5 text-[11px] text-slate-500">
          {Array.from(new Set(order.flatMap((k) => kpis[k].assumptions ?? []))).map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------ TCPI & PPC */

function StatusBadge({ kpi }: { kpi: ExplainedKpi }) {
  const t = KPI_STATUS_TOKENS[kpi.status]
  const label = kpi.data_quality === 'ok' ? t.label_fa : DATA_QUALITY_FA[kpi.data_quality]
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t.bg} ${t.text} ${t.border}`}>{label}</span>
}

/** Renders one KPI strictly from the contract: no value is shown unless data_quality allows it. */
function KpiBlock({ kpi, math, digits }: { kpi: ExplainedKpi; math: ReactNode; digits: number }) {
  const t = KPI_STATUS_TOKENS[kpi.status]
  const usable = kpi.data_quality === 'ok' || kpi.data_quality === 'stale'
  return (
    <div className="space-y-2 rounded-xl p-3 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">
          {kpi.code ? <span className="text-slate-500">{kpi.code} · </span> : null}
          {kpi.title_fa}
        </p>
        <StatusBadge kpi={kpi} />
      </div>
      <p className={`text-lg font-bold tabular-nums ${usable ? 'text-slate-900' : 'text-slate-400'}`}>
        {!usable ? DATA_QUALITY_FA[kpi.data_quality] : kpi.value == null ? 'تعریف‌نشده' : faNumber(kpi.value, digits)}{' '}
        {usable ? <span className="text-xs font-normal text-slate-500">{kpi.unit}</span> : null}
      </p>
      <MathBlock>{math}</MathBlock>
      <p className="text-xs leading-5 text-slate-700">{kpi.interpretation_fa}</p>
      {usable && kpi.actionable_decision_fa ? (
        <div className={`rounded-lg border px-3 py-2 text-xs leading-5 ${t.bg} ${t.text} ${t.border}`}>
          <span className="font-semibold">اقدام مدیریتی خودکار: </span>
          {kpi.actionable_decision_fa}
        </div>
      ) : null}
      {((kpi.debug?.warnings as string[] | undefined) ?? []).map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {w}
        </p>
      ))}
      <p className="text-[10px] leading-4 text-slate-400">
        کیفیت داده: {DATA_QUALITY_FA[kpi.data_quality]} · تاریخ شواهد {jalaliDate(kpi.evidence.asOf)} · منبع: {kpi.evidence.sources.join(' / ')}
      </p>
    </div>
  )
}

function TcpiMath({ metric }: { metric: ExplainedKpi }) {
  const d = (metric.debug ?? {}) as { bac?: number; ev?: number; ac?: number; remainingWork?: number; remainingBudget?: number; case?: string }
  return (
    <>
      <MathLine>
        <V sub="BAC">TCPI</V>
        <Op>=</Op>
        <Frac
          num={
            <>
              <V>BAC</V>
              <Op>−</Op>
              <V>EV</V>
            </>
          }
          den={
            <>
              <V>BAC</V>
              <Op>−</Op>
              <V>AC</V>
            </>
          }
        />
      </MathLine>
      {d.case === 'computed' || d.case === 'budget_exhausted' ? (
        <MathLine>
          <V sub="BAC">TCPI</V>
          <Op>=</Op>
          <Frac num={<Num>{lat(d.bac)} − {lat(d.ev)}</Num>} den={<Num>{lat(d.bac)} − {lat(d.ac)}</Num>} />
          <Op>=</Op>
          <Frac num={<Num>{lat(d.remainingWork)}</Num>} den={<Num>{lat(d.remainingBudget)}</Num>} />
          <Op>=</Op>
          <Num>{metric.value == null ? '∞' : lat(metric.value, 3)}</Num>
        </MathLine>
      ) : (
        <MathLine>
          <span className="font-sans text-xs not-italic">{metric.substitution}</span>
        </MathLine>
      )}
      <p dir="rtl" className="font-sans text-[11px] text-slate-500">
        BAC = بودجهٔ مصوب مبنا · EV = ارزش کسب‌شدهٔ تجمعی · AC = هزینهٔ واقعی تجمعی
      </p>
    </>
  )
}

function PpcMath({ metric }: { metric: ExplainedKpi }) {
  const d = (metric.debug ?? {}) as { planned?: number; completed?: number }
  return (
    <>
      <MathLine>
        <V>PPC</V>
        <Op>=</Op>
        <Frac num={<V>Completed</V>} den={<V>Planned Committed</V>} />
        <Op>×</Op>
        <Num>100</Num>
      </MathLine>
      {(d.planned ?? 0) > 0 ? (
        <MathLine>
          <V>PPC</V>
          <Op>=</Op>
          <Frac num={<Num>{d.completed}</Num>} den={<Num>{d.planned}</Num>} />
          <Op>×</Op>
          <Num>100</Num>
          <Op>=</Op>
          <Num>{lat(metric.value, 1)}%</Num>
        </MathLine>
      ) : (
        <MathLine>
          <span className="font-sans text-xs not-italic">{metric.substitution}</span>
        </MathLine>
      )}
    </>
  )
}

function TcpiPpcCard({ snapshot, projectId }: { snapshot: ProjectEvmSnapshot; projectId: string }) {
  const weekly = useJson<WeeklyPlanLoad>(`/api/manager/weekly-plan?projectId=${encodeURIComponent(projectId)}`)
  const { tcpi, ppc } = useMemo(() => {
    const controls = buildControlsSnapshot({
      evm: snapshot,
      weeklyPlan: weekly.state === 'ok' && weekly.data.status === 'ok' ? weekly.data.counts : null,
      weeklyPlanMissingReason:
        weekly.state === 'ok' && weekly.data.status === 'missing'
          ? weekly.data.reason_fa
          : weekly.state === 'error'
            ? `خواندن برنامهٔ هفتگی ناموفق بود: ${weekly.message}`
            : undefined,
    })
    return { tcpi: buildTcpiKpi(controls), ppc: buildPpcKpi(controls) }
  }, [snapshot, weekly])

  return (
    <SectionCard title="TCPI و PPC (شاخص‌های اقدام‌محور)" icon={<Sigma className="h-4 w-4" aria-hidden />}>
      <div className="grid gap-3 lg:grid-cols-2">
        <KpiBlock kpi={tcpi} math={<TcpiMath metric={tcpi} />} digits={3} />
        {weekly.state === 'loading' ? <LoadingRows /> : <KpiBlock kpi={ppc} math={<PpcMath metric={ppc} />} digits={1} />}
      </div>
    </SectionCard>
  )
}

/* --------------------------------------------------------------- 24 hours */

function DailyCard({ overview }: { overview: ManagerOverview }) {
  const d = overview.daily.status === 'ok' ? overview.daily.data : null
  return (
    <SectionCard title="عملکرد 24 ساعت گذشته" icon={<CalendarClock className="h-4 w-4" aria-hidden />}>
      {d ? (
        <div className="space-y-3">
          <MathBlock>
            <MathLine>
              <V>Planned</V>
              <Op>=</Op>
              <V>max</V>
              <Op>(</Op>
              <Num>0</Num>
              <Op>,</Op>
              <V sub="today">Plan</V>
              <Op>−</Op>
              <V sub="yesterday">Plan</V>
              <Op>)</Op>
            </MathLine>
            <MathLine>
              <WeightedAverage label={<V>Actual</V>} weight={<V sub="i">w</V>} value={<V sub="i">Δp</V>} />
              <span className="w-6" />
              <V>Fulfillment</V>
              <Op>=</Op>
              <Frac num={<V>Actual</V>} den={<V>Planned</V>} />
              <Op>×</Op>
              <Num>100</Num>
            </MathLine>
            <p dir="rtl" className="font-sans text-[11px] text-slate-500">Plan = برنامهٔ وزنی تجمعی روی baseline · Δp = پیشرفت ثبت‌شده در 24 ساعت گذشته</p>
          </MathBlock>
          <div className="grid gap-2 sm:grid-cols-4">
            <Result label="شروع پنجره" value={jalaliDateTime(d.windowStart)} />
            <Result label="برنامهٔ مصوب امروز" value={faPercent(d.plannedPercent, 2)} note={d.baselineEnded ? 'دورهٔ برنامهٔ مبنا تمام شده' : undefined} />
            <Result label="ثبت‌شده در 24 ساعت" value={faPercent(d.actualPercent, 2)} />
            <Result label="درصد تحقق" value={d.fulfillmentPercent == null ? '—' : faPercent(d.fulfillmentPercent, 0)} />
          </div>
          <p className="text-xs text-slate-600">
            فعالیت‌های دارای برنامه امروز: {faNumber(d.plannedActivities)} · گزارش‌شده از آن‌ها: {faNumber(d.plannedReportedActivities)} · کل
            فعالیت‌های گزارش‌شده: {faNumber(d.reportedActivities)} · عقب از پایان مبنا: {faNumber(d.overdueActivities)}
          </p>
        </div>
      ) : (
        <EmptyNote title="داده در دسترس نیست" description={overview.daily.status === 'ok' ? undefined : 'reason' in overview.daily ? overview.daily.reason : overview.daily.message} />
      )}
    </SectionCard>
  )
}

/* ------------------------------------------------------- Package weights */

function PackageWeightsCard({ nodes }: { nodes: ScheduleTreeNode[] }) {
  const parents = nodes.filter((node) => (node.packages ?? []).length > 0)
  if (parents.length === 0) return null
  return (
    <SectionCard title="وزن بسته‌های کاری" icon={<Layers className="h-4 w-4" aria-hidden />}>
      <div className="space-y-3">
        <p className="text-xs leading-5 text-slate-600">
          وزن بسته‌ها «مطلق» است: هم‌واحد با وزن فعالیت والد، و جمع وزن بسته‌های یک والد باید دقیقاً برابر وزن والد باشد. بستهٔ بدون وزن،
          باقی‌ماندهٔ وزن والد را به‌تساوی با هم‌ردیف‌های بی‌وزن تقسیم می‌کند. اگر جمع نخواند، وزن‌ها به نسبت تا وزن والد مقیاس می‌شوند و
          خطای کیفیت داده ثبت می‌شود؛ محاسبه متوقف نمی‌شود. برنامهٔ (PV) هر بسته از baseline فعالیت والد خوانده می‌شود.
        </p>
        <Table
          head={['فعالیت والد', 'وزن والد', 'بسته', 'وزن ثبت‌شده', 'درصد فیزیکی بسته', 'وزن مؤثر در محاسبه']}
          rows={parents.flatMap((node) => {
            const parentWeight = Number(node.scheduleWeight) || 0
            const packages = node.packages ?? []
            const { weights } = resolveSiblingWeights(parentWeight, packages.map((p) => p.weightPercent))
            return packages.map((pkg, index) => {
              const fields = (pkg.scheduleFields ?? {}) as Record<string, unknown>
              const pct = Number(fields.physical_percent_complete ?? fields.percent_complete ?? 0)
              return [
                index === 0 ? activityLabel({ wbs: node.wbs, name: node.name }) : '',
                index === 0 ? n(parentWeight) : '',
                pkg.name,
                pkg.weightPercent == null ? 'بدون وزن' : n(Number(pkg.weightPercent)),
                faPercent(pct, 0),
                n(weights[index] ?? 0),
              ]
            })
          })}
        />
        {parents.map((node) => {
          const parentWeight = Number(node.scheduleWeight) || 0
          const packages = node.packages ?? []
          const sum = packages.reduce((s, p) => s + (Number(p.weightPercent) || 0), 0)
          const { issue } = resolveSiblingWeights(parentWeight, packages.map((p) => p.weightPercent))
          return (
            <p key={node.id} className={`text-xs ${issue ? 'text-amber-700' : 'text-emerald-700'}`}>
              {node.wbs} {node.name}: جمع وزن بسته‌ها {n(sum)} در برابر وزن والد {n(parentWeight)} ·{' '}
              {issue ? issue.message_fa : 'سازگار است'}
            </p>
          )
        })}
      </div>
    </SectionCard>
  )
}

/* ---------------------------------------------------- Supervisor progress */

function latestEntry(entries: DailyProgressEntry[], id: string, asOf: string): DailyProgressEntry | null {
  let best: DailyProgressEntry | null = null
  for (const e of entries) {
    if (e.activityId !== id || e.reportDate > asOf) continue
    if (!best || e.reportDate > best.reportDate) best = e
  }
  return best
}

function SupervisorCard({
  nodes,
  orphanPackages,
  projectId,
  managerValue,
}: {
  nodes: ScheduleTreeNode[]
  orphanPackages: WorkshopPackageNode[]
  projectId: string
  managerValue: number | null
}) {
  const computed = useMemo(() => {
    const today = todayTehranIso()
    const curve = buildSCurveActivitiesFromTree(nodes)
    const packages = buildDailyReportActivitiesFromTree(nodes, orphanPackages).filter((a) => a.kind === 'package')
    const entries = readProjectDailyProgress(projectId).entries
    const rows = curve.map((activity: DailyReportActivity) => {
      const own = latestEntry(entries, activity.id, today)
      const used = progressForSCurveAsOf(activity, entries, today, today, packages)
      const source = own
        ? `گزارش ذخیره‌شده در این مرورگر (${jalaliDate(own.reportDate)})`
        : packages.some((p) => p.parentTaskId === activity.parentTaskId && latestEntry(entries, p.id, today))
          ? 'گزارش بسته‌ها در این مرورگر'
          : 'درصد برنامهٔ زمان‌بندی'
      return { activity, used, source }
    })
    const value = calculateSCurveActualProgress(curve, entries, today, today, packages)
    const totalWeight = curve.reduce((s, a) => s + (a.progressWeight > 0 ? a.progressWeight : 1), 0)
    return { rows, value, totalWeight, localCount: entries.length }
  }, [nodes, orphanPackages, projectId])

  return (
    <SectionCard title="پیشرفت در کارتابل سرپرست کارگاه" icon={<HardHat className="h-4 w-4" aria-hidden />}>
      <div className="space-y-3">
        <MathBlock>
          <MathLine>
            <WeightedAverage label={<V>Progress</V>} weight={<V sub="i">w</V>} value={<V sub="i">p</V>} />
          </MathLine>
          <MathLine>
            <V>Progress</V>
            <Op>=</Op>
            <Num>{lat(computed.value)}%</Num>
          </MathLine>
          <p dir="rtl" className="font-sans text-[11px] text-slate-500">
            فقط فعالیت‌های برگ MSP شمرده می‌شوند و بسته‌ها ردیف جدا ندارند · p = درصد استفاده‌شده (ستون جدول زیر)
          </p>
        </MathBlock>
        <p className="text-xs leading-5 text-slate-600">
          «درصد استفاده‌شده» اگر برای فعالیت در همین مرورگر گزارشی ذخیره شده باشد از آن گزارش می‌آید، وگرنه درصد برنامهٔ زمان‌بندی (گرد
          شده به عدد صحیح). به همین دلیل این عدد در مرورگرهای مختلف می‌تواند فرق کند. گزارش‌های ذخیره‌شده در این مرورگر:{' '}
          {faNumber(computed.localCount)}.
        </p>
        <Table
          head={['فعالیت', 'وزن', 'درصد برنامهٔ زمان‌بندی', 'درصد استفاده‌شده', 'منبع']}
          rows={computed.rows.map(({ activity, used, source }) => [
            activityLabel({ wbs: activity.wbs, name: activity.name }),
            n(activity.progressWeight),
            faPercent(activity.baselinePercentComplete ?? 0, 0),
            faPercent(used, 1),
            source,
          ])}
          foot={['جمع وزن', n(computed.totalWeight), '', '', '']}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <Result label="پیشرفت سرپرست (در این مرورگر)" value={faPercent(computed.value, 2)} />
          <Result label="پیشرفت تجمعی مدیر" value={managerValue == null ? '—' : faPercent(managerValue, 2)} />
          <Result
            label="اختلاف"
            value={managerValue == null ? '—' : `${faNumber(managerValue - computed.value, 2)} واحد`}
            note="علت: شمارش متفاوت بسته‌ها، جمع وزن متفاوت و گزارش‌های ذخیره‌شده در مرورگر"
          />
        </div>
      </div>
    </SectionCard>
  )
}

/* ------------------------------------------------------------------- Page */

type ScheduleTreeResponse = { nodes: ScheduleTreeNode[]; orphanPackages?: WorkshopPackageNode[] }

export function ManagerBackgroundView({
  projectId,
  overview,
  loading,
}: {
  projectId: string | null
  overview: ManagerOverview | null
  loading: boolean
}) {
  const evm = useJson<ProjectEvmSnapshot>(projectId ? `/api/project-manager/evm?projectId=${encodeURIComponent(projectId)}` : null)
  const tree = useJson<ScheduleTreeResponse>(projectId ? `/api/workshop/schedule-tree?projectId=${encodeURIComponent(projectId)}` : null)
  const managerValue = overview?.evm.status === 'ok' ? overview.evm.data.actualPercent : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/manager"
          className="inline-flex items-center gap-1 rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
          بازگشت به داشبورد
        </Link>
        <h1 className="text-sm font-bold text-slate-800">بک‌گراند محاسبات — ریز هر عدد داشبورد با داده‌های واقعی پروژه</h1>
      </div>

      <ConventionsCard />

      {!projectId ? <EmptyNote title="پروژه‌ای انتخاب نشده است" /> : null}

      {projectId ? (
        evm.state === 'ok' ? (
          <>
            <CumulativeCard activities={evm.data.activities} cardValue={managerValue} weightIssues={evm.data.weightIssues ?? []} />
            <EvmCard snapshot={evm.data} />
            <EarnedScheduleCard snapshot={evm.data} />
            <TcpiPpcCard snapshot={evm.data} projectId={projectId} />
          </>
        ) : (
          <SectionCard title="پیشرفت تجمعی و EVM" icon={<Calculator className="h-4 w-4" aria-hidden />}>
            <StateNote load={evm} />
          </SectionCard>
        )
      ) : null}

      {overview ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ForecastCard overview={overview} />
          <DailyCard overview={overview} />
        </div>
      ) : loading ? (
        <LoadingRows rows={3} />
      ) : null}

      {projectId ? (
        tree.state === 'ok' ? (
          <>
            <PackageWeightsCard nodes={tree.data.nodes ?? []} />
            <SupervisorCard
              nodes={tree.data.nodes ?? []}
              orphanPackages={tree.data.orphanPackages ?? []}
              projectId={projectId}
              managerValue={managerValue}
            />
          </>
        ) : (
          <SectionCard title="وزن بسته‌ها و پیشرفت سرپرست" icon={<HardHat className="h-4 w-4" aria-hidden />}>
            <StateNote load={tree} />
          </SectionCard>
        )
      ) : null}
    </div>
  )
}
