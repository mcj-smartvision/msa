'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleHelp, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatScheduleDate } from '@/features/schedule/lib/dates'
import { EVM_COST_SOURCES, type EvmCostSource } from '@/features/evm/lib/metrics'
import { DEFAULT_RAG_THRESHOLDS as T } from '@/features/evm/lib/rag-status'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'

const COST_SOURCE_LABEL: Record<EvmCostSource, string> = {
  expense: 'اسناد هزینهٔ حسابداری (نهایی / اصلاح‌شده)',
  vendor_bill: 'صورت‌حساب تأمین‌کنندگان',
  overhead: 'جدول هزینهٔ بالاسری کارگاه',
}

const RAG_LABEL = { GREEN: 'سبز', AMBER: 'زرد', RED: 'قرمز' } as const

function n(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`
}

function ratio(value: number | null): string {
  return value == null ? '—' : value.toFixed(2)
}

function jalali(iso: string | null): string {
  return iso ? formatScheduleDate(iso, 'jalali') : '—'
}

function Calc({ children }: { children: ReactNode }) {
  return (
    <p
      dir="ltr"
      className="inline-block rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[13px] text-slate-800"
    >
      {children}
    </p>
  )
}

function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="space-y-1.5 text-xs leading-6 text-slate-600">{children}</div>
    </section>
  )
}

type Check = { label: string; value: string; verdict: string; tone: 'ok' | 'warn' | 'bad' | 'skip' }

function ragChecks(s: ProjectEvmSnapshot): Check[] {
  const indexCheck = (label: string, value: number | null, missing: string): Check => {
    if (value == null) return { label, value: '—', verdict: `${missing}؛ در ارزیابی حساب نشد`, tone: 'skip' }
    if (value < T.critical) return { label, value: ratio(value), verdict: `کمتر از ${T.critical} ← قرمز`, tone: 'bad' }
    if (value < T.onTrack) return { label, value: ratio(value), verdict: `بین ${T.critical} و ${T.onTrack} ← زرد`, tone: 'warn' }
    return { label, value: ratio(value), verdict: `حداقل ${T.onTrack} ← سبز`, tone: 'ok' }
  }
  const { criticalFloatDays: cf, floatConsumptionPercent: fc } = s.float
  return [
    indexCheck('SPI', s.metrics.spi, 'PV صفر است'),
    indexCheck('CPI', s.metrics.cpi, 'AC صفر است'),
    cf == null
      ? { label: 'کمترین شناوری بحرانی', value: '—', verdict: 'CPM اجرا نشده؛ حساب نشد', tone: 'skip' }
      : cf < 0
        ? { label: 'کمترین شناوری بحرانی', value: `${n(cf)} روز`, verdict: 'منفی ← قرمز', tone: 'bad' }
        : { label: 'کمترین شناوری بحرانی', value: `${n(cf)} روز`, verdict: 'نامنفی ← سبز', tone: 'ok' },
    fc == null
      ? { label: 'مصرف شناوری', value: '—', verdict: 'تاریخچه ندارد؛ حساب نشد', tone: 'skip' }
      : fc > T.floatConsumptionAmber
        ? { label: 'مصرف شناوری', value: `${Math.round(fc)}٪`, verdict: `بیش از ${T.floatConsumptionAmber}٪ ← زرد`, tone: 'warn' }
        : { label: 'مصرف شناوری', value: `${Math.round(fc)}٪`, verdict: `حداکثر ${T.floatConsumptionAmber}٪ ← سبز`, tone: 'ok' },
  ]
}

const CHECK_TONE: Record<Check['tone'], string> = {
  ok: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
  skip: 'text-slate-400',
}

function ActivityTable({ s }: { s: ProjectEvmSnapshot }) {
  const { metrics, activities } = s
  const byWeight = metrics.budgetBasis === 'weighted_project_budget'
  if (activities.length === 0) {
    return <p>هیچ فعالیتی بودجه ندارد؛ در «ویرایش برنامه زمانبندی» مقدار و قیمت واحد وارد نشده است.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-[12px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-start">
            <th className="px-2 py-2 text-start font-medium">WBS</th>
            <th className="px-2 py-2 text-start font-medium">فعالیت</th>
            <th className="px-2 py-2 text-start font-medium">
              {byWeight ? 'بودجه = وزن × بودجهٔ پروژه' : 'بودجه = مقدار × قیمت واحد'}
            </th>
            <th className="px-2 py-2 text-start font-medium">baseline شروع ← پایان</th>
            <th className="px-2 py-2 text-start font-medium">٪ برنامه‌ای</th>
            <th className="px-2 py-2 text-start font-medium">PV = بودجه × ٪ برنامه‌ای</th>
            <th className="px-2 py-2 text-start font-medium">٪ فیزیکی</th>
            <th className="px-2 py-2 text-start font-medium">EV = بودجه × ٪ فیزیکی</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {activities.map((a) => (
            <tr key={`${a.kind}:${a.id}`}>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{a.wbs ?? '—'}</td>
              <td className="px-2 py-1.5">
                {a.name}
                {a.kind === 'package' ? <span className="ms-1 text-slate-400">(زیرشاخه)</span> : null}
              </td>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">
                {byWeight
                  ? `${a.weight.toFixed(2)}% × ${n(s.projectBudget ?? 0)} = ${n(a.budget)}`
                  : `${a.quantity} × ${n(a.unitPrice)} = ${n(a.budget)}`}
              </td>
              <td className="px-2 py-1.5 tabular-nums">
                {jalali(a.baselineStart)} ← {jalali(a.baselineFinish)}
              </td>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{pct(a.plannedPercent)}</td>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{n(a.pv)}</td>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{pct(a.physicalPercent)}</td>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{n(a.ev)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold text-slate-900">
          <tr>
            <td className="px-2 py-2" colSpan={2}>جمع ({activities.length} فعالیت)</td>
            <td className="px-2 py-2 tabular-nums" dir="ltr">BAC = {n(metrics.bac)}</td>
            <td />
            <td />
            <td className="px-2 py-2 tabular-nums" dir="ltr">PV = {n(metrics.pv)}</td>
            <td />
            <td className="px-2 py-2 tabular-nums" dir="ltr">EV = {n(metrics.ev)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CostTable({ s }: { s: ProjectEvmSnapshot }) {
  const { costs, metrics } = s
  if (costs.length === 0) {
    return (
      <p>
        تا {jalali(metrics.asOf)} هیچ رکوردی در این سه منبع ثبت نشده است:{' '}
        {EVM_COST_SOURCES.map((key) => COST_SOURCE_LABEL[key]).join('، ')}. پس AC = 0.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 text-start font-medium">منبع</th>
            <th className="px-2 py-2 text-start font-medium">رکورد</th>
            <th className="px-2 py-2 text-start font-medium">تاریخ</th>
            <th className="px-2 py-2 text-start font-medium">محاسبه</th>
            <th className="px-2 py-2 text-start font-medium">مبلغ (تومان)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {EVM_COST_SOURCES.flatMap((source) => {
            const rows = costs.filter((c) => c.source === source)
            if (rows.length === 0) return []
            return [
              ...rows.map((c, i) => (
                <tr key={`${source}-${i}`}>
                  <td className="px-2 py-1.5">{i === 0 ? COST_SOURCE_LABEL[source] : ''}</td>
                  <td className="px-2 py-1.5">{c.label ?? '—'}</td>
                  <td className="px-2 py-1.5 tabular-nums">{jalali(c.date)}</td>
                  <td className="px-2 py-1.5 text-slate-500">{c.note ?? ''}</td>
                  <td className="px-2 py-1.5 tabular-nums" dir="ltr">{n(c.amount)}</td>
                </tr>
              )),
              <tr key={`${source}-sum`} className="bg-slate-50/60 font-medium">
                <td className="px-2 py-1.5" colSpan={4}>جمع {COST_SOURCE_LABEL[source]}</td>
                <td className="px-2 py-1.5 tabular-nums" dir="ltr">{n(metrics.acBySource[source])}</td>
              </tr>,
            ]
          })}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold text-slate-900">
          <tr>
            <td className="px-2 py-2" colSpan={4}>AC</td>
            <td className="px-2 py-2 tabular-nums" dir="ltr">{n(metrics.ac)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function taskLabel(task: { name: string; wbs: string | null } | null): string {
  if (!task) return 'فعالیت نامشخص'
  return task.wbs ? `${task.wbs} — ${task.name}` : task.name
}

function SourcesContent({ s }: { s: ProjectEvmSnapshot }) {
  const m = s.metrics
  const f = s.float
  return (
    <div className="space-y-4">
      <Section title={`وضعیت پروژه: ${s.rag.evaluated ? RAG_LABEL[s.rag.status] : 'داده ناکافی'}`}>
        <ul className="space-y-1">
          {ragChecks(s).map((c) => (
            <li key={c.label} className="flex flex-wrap gap-x-2">
              <span className="font-medium text-slate-800">{c.label}:</span>
              <span dir="ltr" className="tabular-nums">{c.value}</span>
              <span className={CHECK_TONE[c.tone]}>{c.verdict}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={<Ltr>SPI = {ratio(m.spi)}</Ltr>}>
        <Calc>
          EV {n(m.ev)} ÷ PV {n(m.pv)}
          {m.spi == null ? '' : ` = ${ratio(m.spi)}`}
        </Calc>
        <p>
          {m.spi == null ? 'PV صفر است، پس تقسیم انجام نمی‌شود. ' : ''}
          EV و PV جمع ستون‌های جدول فعالیت‌ها در پایین همین صفحه‌اند.
        </p>
      </Section>

      <Section title={<Ltr>CPI = {ratio(m.cpi)}</Ltr>}>
        <Calc>
          EV {n(m.ev)} ÷ AC {n(m.ac)}
          {m.cpi == null ? '' : ` = ${ratio(m.cpi)}`}
        </Calc>
        <p>
          {m.cpi == null ? 'AC صفر است، پس تقسیم انجام نمی‌شود. ' : ''}
          AC جمع جدول هزینه‌ها در پایین همین صفحه است.
        </p>
      </Section>

      <Section
        title={
          <>
            پیشرفت واقعی = <Ltr>{pct(m.earnedPercent)}</Ltr> · پیشرفت برنامه‌ای ={' '}
            <Ltr>{pct(m.plannedPercent)}</Ltr>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Calc>EV {n(m.ev)} ÷ BAC {n(m.bac)} × 100 = {pct(m.earnedPercent)}</Calc>
          <Calc>PV {n(m.pv)} ÷ BAC {n(m.bac)} × 100 = {pct(m.plannedPercent)}</Calc>
        </div>
      </Section>

      <Section
        title={
          <>
            <Ltr>SV</Ltr> و <Ltr>CV</Ltr>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Calc>SV = EV {n(m.ev)} − PV {n(m.pv)} = {n(m.sv)}</Calc>
          <Calc>CV = EV {n(m.ev)} − AC {n(m.ac)} = {n(m.cv)}</Calc>
        </div>
      </Section>

      <Section
        title={
          <>
            <Ltr>BAC</Ltr>، <Ltr>PV</Ltr> و <Ltr>EV</Ltr> — {s.activities.length} فعالیت بودجه‌دار تا{' '}
            {jalali(m.asOf)}
          </>
        }
      >
        <p>
          منبع هر ردیف: «دفتر فنی ← ویرایش برنامه زمانبندی»؛ مقدار، قیمت واحد، تاریخ‌های baseline برنامه
          MSP و ٪ پیشرفت فیزیکی همان فعالیت.
          {m.budgetBasis === 'technical_office_cost'
            ? ' بودجهٔ هر ردیف = ستون «هزینه» همان فعالیت در برنامهٔ دفتر فنی (بسته‌های کاری سهم هزینهٔ فعالیت والد را به نسبت وزن می‌گیرند)؛ ردیف‌های خلاصه جمع زیرمجموعه‌اند و دوباره شمرده نمی‌شوند.'
            : m.budgetBasis === 'weighted_project_budget'
              ? ` هیچ فعالیتی قیمت واحد ندارد، پس بودجهٔ پروژه (${n(s.projectBudget ?? 0)} تومان) به نسبت وزن تقسیم شده است.`
              : ''}
        </p>
        <ActivityTable s={s} />
      </Section>

      <Section
        title={
          <>
            <Ltr>AC = {n(m.ac)}</Ltr> تومان
          </>
        }
      >
        <CostTable s={s} />
      </Section>

      <Section title="شناوری مسیر بحرانی و مصرف شناوری">
        {f.criticalFloatDays == null ? (
          <p>برای این پروژه هنوز CPM محاسبه نشده است.</p>
        ) : (
          <p>
            کمترین شناوری کل: فعالیت «{taskLabel(f.criticalTask)}» با{' '}
            <span dir="ltr" className="tabular-nums font-medium">{n(f.criticalFloatDays)}</span> روز، از آخرین
            محاسبهٔ CPM برنامه
            {f.criticalFromAllTasks ? ' (هیچ فعالیتی بحرانی علامت نخورده بود، پس بین همهٔ فعالیت‌ها)' : ' (بین فعالیت‌های بحرانی)'}.
          </p>
        )}
        {f.floatConsumptionPercent == null ||
        f.worstInitialFloat == null ||
        f.worstCurrentFloat == null ? (
          <p>مصرف شناوری: هیچ فعالیتی در تاریخچهٔ CPM شناوری اولیهٔ مثبت ندارد، پس قابل محاسبه نیست.</p>
        ) : f.floatConsumptionPercent === 0 ? (
          <p>
            مصرف شناوری ۰٪: شناوری فعلی هیچ فعالیتی از اولین شناوری ثبت‌شده‌اش در تاریخچهٔ CPM کمتر نشده است.
          </p>
        ) : (
          <>
            <p>بیشترین مصرف شناوری: فعالیت «{taskLabel(f.worstConsumptionTask)}»</p>
            <Calc>
              ({n(f.worstInitialFloat)} − {n(f.worstCurrentFloat)}) ÷ {n(f.worstInitialFloat)} × 100 ={' '}
              {Math.round(f.floatConsumptionPercent)}%
            </Calc>
            <p>عدد اول اولین شناوری ثبت‌شده در تاریخچهٔ CPM و عدد دوم شناوری فعلی است.</p>
          </>
        )}
      </Section>
    </div>
  )
}

export function EvmSourcesButton({ snapshot }: { snapshot: ProjectEvmSnapshot | null }) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!snapshot}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-40"
        aria-label="منبع و محاسبهٔ شاخص‌های سلامت پروژه"
        aria-haspopup="dialog"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
      {open && snapshot ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="منبع و محاسبهٔ شاخص‌های سلامت پروژه"
            className={cn('w-full max-w-5xl rounded-xl bg-white text-start shadow-2xl')}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-white px-5 py-3">
              <p className="text-base font-bold text-slate-900">
                منبع و محاسبهٔ اعداد — تا {jalali(snapshot.metrics.asOf)}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <SourcesContent s={snapshot} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
