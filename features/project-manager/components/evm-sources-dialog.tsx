/**
 * @file features/project-manager/components/evm-sources-dialog.tsx
 * @purpose کامپوننت UI — اتاق فرمان مدیر پروژه و کارتابل (evm-sources-dialog)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on shared/lib/utils, features/schedule/lib/dates, features/evm/lib/metrics, features/evm/lib/rag-status, features/evm/lib/load-project-evm, features/project-manager/config
 */

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleHelp, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatScheduleDate } from '@/features/schedule/lib/dates'
import { EVM_COST_SOURCES, type EvmCostSource } from '@/features/evm/lib/metrics'
import { DEFAULT_RAG_THRESHOLDS as T } from '@/features/evm/lib/rag-status'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import { EVM_SOURCES_COPY } from '@/features/project-manager/config'

const C = EVM_SOURCES_COPY

const COST_SOURCE_LABEL: Record<EvmCostSource, string> = C.costSource

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
    if (value == null) return { label, value: '—', verdict: C.missingSkipped(missing), tone: 'skip' }
    if (value < T.critical) return { label, value: ratio(value), verdict: C.belowCritical(T.critical), tone: 'bad' }
    if (value < T.onTrack) return { label, value: ratio(value), verdict: C.betweenAmber(T.critical, T.onTrack), tone: 'warn' }
    return { label, value: ratio(value), verdict: C.atLeastGreen(T.onTrack), tone: 'ok' }
  }
  const { criticalFloatDays: cf, floatConsumptionPercent: fc } = s.float
  return [
    indexCheck('SPI', s.metrics.spi, C.pvZero),
    indexCheck('CPI', s.metrics.cpi, C.acZero),
    cf == null
      ? { label: C.minCriticalFloat, value: '—', verdict: C.cpmNotRun, tone: 'skip' }
      : cf < 0
        ? { label: C.minCriticalFloat, value: C.days(n(cf)), verdict: C.negativeRed, tone: 'bad' }
        : { label: C.minCriticalFloat, value: C.days(n(cf)), verdict: C.nonnegativeGreen, tone: 'ok' },
    fc == null
      ? { label: C.floatConsumption, value: '—', verdict: C.noHistorySkipped, tone: 'skip' }
      : fc > T.floatConsumptionAmber
        ? { label: C.floatConsumption, value: C.percent(fc), verdict: C.floatOverAmber(T.floatConsumptionAmber), tone: 'warn' }
        : { label: C.floatConsumption, value: C.percent(fc), verdict: C.floatAtMostGreen(T.floatConsumptionAmber), tone: 'ok' },
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
    return <p>{C.noBudgetActivities}</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-[12px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr className="text-start">
            <th className="px-2 py-2 text-start font-medium">WBS</th>
            <th className="px-2 py-2 text-start font-medium">{C.activity}</th>
            <th className="px-2 py-2 text-start font-medium">
              {byWeight ? C.budgetByWeight : C.budgetByQty}
            </th>
            <th className="px-2 py-2 text-start font-medium">{C.baselineRange}</th>
            <th className="px-2 py-2 text-start font-medium">{C.plannedPct}</th>
            <th className="px-2 py-2 text-start font-medium">{C.pvFormula}</th>
            <th className="px-2 py-2 text-start font-medium">{C.physicalPct}</th>
            <th className="px-2 py-2 text-start font-medium">{C.evFormula}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {activities.map((a) => (
            <tr key={`${a.kind}:${a.id}`}>
              <td className="px-2 py-1.5 tabular-nums" dir="ltr">{a.wbs ?? '—'}</td>
              <td className="px-2 py-1.5">
                {a.name}
                {a.kind === 'package' ? <span className="ms-1 text-slate-400">{C.package}</span> : null}
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
            <td className="px-2 py-2" colSpan={2}>{C.activityTotal(activities.length)}</td>
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
        {C.costEmpty(
          jalali(metrics.asOf),
          EVM_COST_SOURCES.map((key) => COST_SOURCE_LABEL[key]).join(C.listSep)
        )}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 text-start font-medium">{C.source}</th>
            <th className="px-2 py-2 text-start font-medium">{C.record}</th>
            <th className="px-2 py-2 text-start font-medium">{C.date}</th>
            <th className="px-2 py-2 text-start font-medium">{C.calc}</th>
            <th className="px-2 py-2 text-start font-medium">{C.amountToman}</th>
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
                <td className="px-2 py-1.5" colSpan={4}>{C.sourceSum(COST_SOURCE_LABEL[source])}</td>
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
  if (!task) return C.unknownActivity
  return task.wbs ? `${task.wbs} — ${task.name}` : task.name
}

function SourcesContent({ s }: { s: ProjectEvmSnapshot }) {
  const m = s.metrics
  const f = s.float
  return (
    <div className="space-y-4">
      <Section title={C.projectStatus(s.rag.evaluated ? C.rag[s.rag.status] : C.rag.insufficient)}>
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
          {m.spi == null ? C.spiNull : ''}
          {C.spiHint}
        </p>
      </Section>

      <Section title={<Ltr>CPI = {ratio(m.cpi)}</Ltr>}>
        <Calc>
          EV {n(m.ev)} ÷ AC {n(m.ac)}
          {m.cpi == null ? '' : ` = ${ratio(m.cpi)}`}
        </Calc>
        <p>
          {m.cpi == null ? C.cpiNull : ''}
          {C.cpiHint}
        </p>
      </Section>

      <Section
        title={
          <>
            {C.earnedProgress} <Ltr>{pct(m.earnedPercent)}</Ltr>
            {' · '}
            {C.plannedProgress}{' '}
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
            <Ltr>SV</Ltr> {C.andWord} <Ltr>CV</Ltr>
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
            <Ltr>BAC</Ltr>
            {C.listSep}
            <Ltr>PV</Ltr>
            {C.and}
            <Ltr>EV</Ltr>
            {C.bacSectionRest(s.activities.length, jalali(m.asOf))}
          </>
        }
      >
        <p>
          {C.activitySourceHint}
          {m.budgetBasis === 'technical_office_cost'
            ? C.technicalOfficeCostHint
            : m.budgetBasis === 'weighted_project_budget'
              ? C.weightedBudgetHint(n(s.projectBudget ?? 0))
              : ''}
        </p>
        <ActivityTable s={s} />
      </Section>

      <Section
        title={
          <>
            <Ltr>AC = {n(m.ac)}</Ltr> {C.toman}
          </>
        }
      >
        <CostTable s={s} />
      </Section>

      <Section title={C.floatSection}>
        {f.criticalFloatDays == null ? (
          <p>{C.cpmMissing}</p>
        ) : (
          <p>
            {C.criticalFloatBefore(taskLabel(f.criticalTask))}{' '}
            <span dir="ltr" className="tabular-nums font-medium">{n(f.criticalFloatDays)}</span> {C.criticalFloatAfter}
            {f.criticalFromAllTasks ? C.criticalFromAll : C.criticalFromCritical}.
          </p>
        )}
        {f.floatConsumptionPercent == null ||
        f.worstInitialFloat == null ||
        f.worstCurrentFloat == null ? (
          <p>{C.floatConsumptionUnavailable}</p>
        ) : f.floatConsumptionPercent === 0 ? (
          <p>{C.floatConsumptionZero}</p>
        ) : (
          <>
            <p>{C.worstConsumption(taskLabel(f.worstConsumptionTask))}</p>
            <Calc>
              ({n(f.worstInitialFloat)} − {n(f.worstCurrentFloat)}) ÷ {n(f.worstInitialFloat)} × 100 ={' '}
              {Math.round(f.floatConsumptionPercent)}%
            </Calc>
            <p>{C.floatNumbersHint}</p>
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
        aria-label={C.sourcesAria}
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
            aria-label={C.sourcesAria}
            className={cn('w-full max-w-5xl rounded-xl bg-white text-start shadow-2xl')}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-slate-100 bg-white px-5 py-3">
              <p className="text-base font-bold text-slate-900">
                {C.dialogTitle(jalali(snapshot.metrics.asOf))}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={C.close}
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
