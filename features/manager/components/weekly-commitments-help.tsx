/**
 * @file features/manager/components/weekly-commitments-help.tsx
 * @purpose کامپوننت UI — داشبورد مدیر پروژه و KPI (weekly-commitments-help)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on features/manager/lib/format, features/manager/lib/weekly-commitments
 */

import type { ReactNode } from 'react'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import { PPC_LOW, type WeeklyCommitmentsData } from '@/features/manager/lib/weekly-commitments'
import { MANAGER_PUNCT, WEEKLY_HELP_COPY } from '@/features/manager/config'

/** Live numbers the help panels quote; null when that number is not available yet. */
export interface HelpContext {
  ppcData: WeeklyCommitmentsData | null
  ppcMissing: string | null
  spi: number | null
  spiT: number | null
  evPct: number | null
  pvPct: number | null
  es: number | null
  at: number | null
  unitFa: string
}

/** Percent with up to `digits` decimals; whole numbers print without a fraction. */
export function pct(v: number, digits = 0): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits
  return `${faNumber(r, Number.isInteger(r) ? 0 : digits)}${MANAGER_PUNCT.percent}`
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-bold text-[#1e2a5e]">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

/** Label/value lines of the card's current numbers; rows without a value are skipped. */
function HelpNumbers({ rows }: { rows: Array<[string, string | null]> }) {
  const shown = rows.filter((r): r is [string, string] => r[1] != null)
  if (shown.length === 0) return <p className="text-slate-500">{WEEKLY_HELP_COPY.noNumbers}</p>
  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-[#faf9f7]">
      {shown.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-3 px-3 py-1.5">
          <dt className="text-slate-600">{label}</dt>
          <dd className="text-left font-bold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-100 px-3 py-1.5 text-center font-bold text-slate-800">{children}</p>
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 ps-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** The scoring rule of phase one, shared by the PPC, trend and commitments panels. */
function PhaseOneRule() {
  return (
    <HelpSection title={WEEKLY_HELP_COPY.phaseOne}>
      <p>
        {WEEKLY_HELP_COPY.phaseIntroBefore}
        <b>{WEEKLY_HELP_COPY.sameSchedule}</b>
        {WEEKLY_HELP_COPY.phaseIntroAfter}
      </p>
      <Bullets
        items={[
          <><b>{WEEKLY_HELP_COPY.phaseLeads.week}</b>{WEEKLY_HELP_COPY.phaseBodies.week}</>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.commits}</b>{WEEKLY_HELP_COPY.phaseBodies.commits}</>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.lock}</b>{WEEKLY_HELP_COPY.phaseBodies.lock}</>,
          <>
            <b>{WEEKLY_HELP_COPY.phaseLeads.share}</b>
            {WEEKLY_HELP_COPY.phaseBodies.shareBefore}
            <Formula>{WEEKLY_HELP_COPY.phaseBodies.shareFormula}</Formula>
            {WEEKLY_HELP_COPY.phaseBodies.shareAfter}
          </>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.actual}</b>{WEEKLY_HELP_COPY.phaseBodies.actual}</>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.score}</b>{WEEKLY_HELP_COPY.phaseBodies.score}</>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.weight}</b>{WEEKLY_HELP_COPY.phaseBodies.weight}</>,
          <><b>{WEEKLY_HELP_COPY.phaseLeads.current}</b>{WEEKLY_HELP_COPY.phaseBodies.current}</>,
        ]}
      />
      <Formula>{WEEKLY_HELP_COPY.ppcFormula}</Formula>
    </HelpSection>
  )
}

function DataSources() {
  return (
    <HelpSection title={WEEKLY_HELP_COPY.sources}>
      <Bullets items={[...WEEKLY_HELP_COPY.sourcesItems]} />
    </HelpSection>
  )
}

export function PpcHelp({ ctx }: { ctx: HelpContext }) {
  const d = ctx.ppcData
  const cur = d?.current ?? null
  const behind = cur?.commitments.filter((c) => !c.completed) ?? []
  const example = behind.find((c) => c.targetPercent != null) ?? cur?.commitments.find((c) => c.targetPercent != null) ?? null
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.what}>
        <p>
          {WEEKLY_HELP_COPY.ppcWhat.split(WEEKLY_HELP_COPY.lastPlanner)[0]}
          <b>{WEEKLY_HELP_COPY.lastPlanner}</b>
          {WEEKLY_HELP_COPY.ppcWhat.split(WEEKLY_HELP_COPY.lastPlanner)[1]}
        </p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.why}>
        <Bullets
          items={[
            <>
              <b>{WEEKLY_HELP_COPY.leading}</b>
              {WEEKLY_HELP_COPY.leadingBody}
            </>,
            WEEKLY_HELP_COPY.trust,
            WEEKLY_HELP_COPY.where,
          ]}
        />
      </HelpSection>
      <PhaseOneRule />
      <HelpSection title={WEEKLY_HELP_COPY.now}>
        {d && cur ? (
          <HelpNumbers
            rows={[
              [WEEKLY_HELP_COPY.weekLabel, WEEKLY_HELP_COPY.weekRange(cur.live ? WEEKLY_HELP_COPY.weekCurrent : WEEKLY_HELP_COPY.weekN(faNumber(cur.weekNumber)), jalaliDate(cur.start), jalaliDate(cur.end))],
              [WEEKLY_HELP_COPY.weekStatus, cur.live ? WEEKLY_HELP_COPY.weekOpen : WEEKLY_HELP_COPY.weekClosed],
              [WEEKLY_HELP_COPY.commitCount, faNumber(cur.planned)],
              [WEEKLY_HELP_COPY.shareDone, faNumber(cur.completed)],
              [WEEKLY_HELP_COPY.behind, faNumber(cur.planned - cur.completed)],
              ['PPC', cur.ppc == null ? null : WEEKLY_HELP_COPY.ppcEq(faNumber(cur.completed), faNumber(cur.planned), pct(cur.ppc))],
              [WEEKLY_HELP_COPY.prevPpc, d.previousPpc == null ? null : pct(d.previousPpc)],
              [WEEKLY_HELP_COPY.avgWeeks(faNumber(d.rnc.weeks)), d.average4 == null ? null : pct(d.average4)],
              [WEEKLY_HELP_COPY.target, pct(d.target)],
            ]}
          />
        ) : (
          <p className="text-slate-500">{ctx.ppcMissing ?? WEEKLY_HELP_COPY.noData}</p>
        )}
        {example && example.targetPercent != null && example.actualPercent != null ? (
          <p>
            <b>{WEEKLY_HELP_COPY.example}</b>
            {WEEKLY_HELP_COPY.exampleBody(example.description, pct(example.targetPercent, 1), pct(example.actualPercent, 1), example.completed)}
          </p>
        ) : null}
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.colorsWhat}>
        <Bullets
          items={[
            WEEKLY_HELP_COPY.green(pct(d?.target ?? 80)),
            WEEKLY_HELP_COPY.yellow(pct(PPC_LOW), pct(d?.target ?? 80)),
            WEEKLY_HELP_COPY.red(pct(PPC_LOW)),
          ]}
        />
      </HelpSection>
      <DataSources />
      <HelpSection title={WEEKLY_HELP_COPY.limits}>
        <Bullets
          items={[...WEEKLY_HELP_COPY.limitItems]}
        />
      </HelpSection>
    </>
  )
}

export function SpiHelp({ ctx }: { ctx: HelpContext }) {
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.what}>
        <p>
          {WEEKLY_HELP_COPY.spiWhat.split(WEEKLY_HELP_COPY.evm)[0]}
          <b>{WEEKLY_HELP_COPY.evm}</b>
          {WEEKLY_HELP_COPY.spiWhat.split(WEEKLY_HELP_COPY.evm)[1]}
        </p>
        <Formula>{WEEKLY_HELP_COPY.spiFormula}</Formula>
        <Bullets
          items={[
            ...WEEKLY_HELP_COPY.spiBullets,
          ]}
        />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.why}>
        <p>
          {WEEKLY_HELP_COPY.spiWhy.split(WEEKLY_HELP_COPY.volume)[0]}
          <b>{WEEKLY_HELP_COPY.volume}</b>
          {WEEKLY_HELP_COPY.spiWhy.split(WEEKLY_HELP_COPY.volume)[1]}
        </p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.now}>
        <HelpNumbers
          rows={[
            [WEEKLY_HELP_COPY.evNow, ctx.evPct == null ? null : pct(ctx.evPct, 1)],
            [WEEKLY_HELP_COPY.pvNow, ctx.pvPct == null ? null : pct(ctx.pvPct, 1)],
            [
              'SPI',
              ctx.spi == null
                ? null
                : ctx.evPct != null && ctx.pvPct != null
                  ? `${faNumber(ctx.evPct, 1)} ÷ ${faNumber(ctx.pvPct, 1)} = ${faNumber(ctx.spi, 2)}`
                  : faNumber(ctx.spi, 2),
            ],
            [WEEKLY_HELP_COPY.meaning, ctx.spi == null ? null : WEEKLY_HELP_COPY.meaningN(faNumber(Math.round(ctx.spi * 100)))],
          ]}
        />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.colors}>
        <Bullets items={[...WEEKLY_HELP_COPY.spiColors]} />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.note}>
        <p>{WEEKLY_HELP_COPY.spiNote}</p>
      </HelpSection>
    </>
  )
}

export function SpiTHelp({ ctx }: { ctx: HelpContext }) {
  const u = ctx.unitFa
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.what}>
        <p>
          {WEEKLY_HELP_COPY.spitWhat.split(WEEKLY_HELP_COPY.earnedSchedule)[0]}
          <b>{WEEKLY_HELP_COPY.earnedSchedule}</b>
          {WEEKLY_HELP_COPY.spitWhat.split(WEEKLY_HELP_COPY.earnedSchedule)[1].split(WEEKLY_HELP_COPY.time)[0]}
          <b>{WEEKLY_HELP_COPY.time}</b>
          {WEEKLY_HELP_COPY.spitWhat.split(WEEKLY_HELP_COPY.earnedSchedule)[1].split(WEEKLY_HELP_COPY.time)[1]}
        </p>
        <Formula>{WEEKLY_HELP_COPY.spitFormula}</Formula>
        <Bullets
          items={[
            WEEKLY_HELP_COPY.esDef(u),
            WEEKLY_HELP_COPY.atDef(u),
          ]}
        />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.why}>
        <p>{WEEKLY_HELP_COPY.spitWhy(u)}</p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.now}>
        <HelpNumbers
          rows={[
            [WEEKLY_HELP_COPY.esNow(u), ctx.es == null ? null : WEEKLY_HELP_COPY.esVal(u, faNumber(ctx.es, 1))],
            [WEEKLY_HELP_COPY.atNow(u), ctx.at == null ? null : WEEKLY_HELP_COPY.atVal(faNumber(ctx.at, 1), u)],
            [
              'SPI(t)',
              ctx.spiT == null
                ? null
                : ctx.es != null && ctx.at != null
                  ? `${faNumber(ctx.es, 1)} ÷ ${faNumber(ctx.at, 1)} = ${faNumber(ctx.spiT, 2)}`
                  : faNumber(ctx.spiT, 2),
            ],
            [
              WEEKLY_HELP_COPY.gap,
              ctx.es != null && ctx.at != null
                ? ctx.at > ctx.es
                  ? WEEKLY_HELP_COPY.spitBehind(faNumber(ctx.at - ctx.es, 1), u)
                  : WEEKLY_HELP_COPY.onOrAhead
                : null,
            ],
          ]}
        />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.colors}>
        <Bullets items={[...WEEKLY_HELP_COPY.spitColors]} />
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.together}>
        <p>{WEEKLY_HELP_COPY.spitTogether}</p>
      </HelpSection>
    </>
  )
}

export function LocksHelp() {
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.lockWhat}>
        <p>{WEEKLY_HELP_COPY.lockBody}</p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.why}>
        <p>{WEEKLY_HELP_COPY.lockWhy}</p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.status}>
        <p>{WEEKLY_HELP_COPY.lockStatus}</p>
      </HelpSection>
    </>
  )
}

export function TrendHelp({ ctx }: { ctx: HelpContext }) {
  const d = ctx.ppcData
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.trendWhat}>
        <p>{WEEKLY_HELP_COPY.trendBody(pct(d?.target ?? 80))}</p>
        <p>{WEEKLY_HELP_COPY.trendNote}</p>
      </HelpSection>
      <PhaseOneRule />
      <HelpSection title={WEEKLY_HELP_COPY.weekNumbers}>
        {d && d.weeks.length ? (
          <HelpNumbers
            rows={d.weeks.map((w) => [
              WEEKLY_HELP_COPY.weekRange(w.live ? WEEKLY_HELP_COPY.weekCurrent : WEEKLY_HELP_COPY.weekN(faNumber(w.weekNumber)), jalaliDate(w.start), jalaliDate(w.end)),
              WEEKLY_HELP_COPY.weekScore(faNumber(w.completed), faNumber(w.planned), w.ppc == null ? '—' : pct(w.ppc)),
            ])}
          />
        ) : (
          <p className="text-slate-500">{ctx.ppcMissing ?? WEEKLY_HELP_COPY.noWeek}</p>
        )}
      </HelpSection>
    </>
  )
}

export function CommitmentsHelp({ ctx }: { ctx: HelpContext }) {
  const cur = ctx.ppcData?.current ?? null
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.boxWhat}>
        <p>
          {WEEKLY_HELP_COPY.listIntro(cur?.live ? WEEKLY_HELP_COPY.currentWeek : WEEKLY_HELP_COPY.lastClosed)}
        </p>
        <Bullets
          items={[
            <>
              <b>{WEEKLY_HELP_COPY.greenTick}</b>
              {WEEKLY_HELP_COPY.greenTickBody}
            </>,
            <>
              <b>{WEEKLY_HELP_COPY.red}</b>
              {WEEKLY_HELP_COPY.redBody}
            </>,
            WEEKLY_HELP_COPY.sorted,
          ]}
        />
        {cur ? (
          <p>
            {WEEKLY_HELP_COPY.nowCount(faNumber(cur.planned), faNumber(cur.completed), faNumber(cur.planned - cur.completed))}
          </p>
        ) : null}
      </HelpSection>
      <PhaseOneRule />
      <DataSources />
    </>
  )
}

export function RncHelp() {
  return (
    <>
      <HelpSection title={WEEKLY_HELP_COPY.rncWhat}>
        <p>{WEEKLY_HELP_COPY.rncBody}</p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.why}>
        <p>{WEEKLY_HELP_COPY.rncWhy}</p>
      </HelpSection>
      <HelpSection title={WEEKLY_HELP_COPY.status}>
        <p>{WEEKLY_HELP_COPY.rncStatus}</p>
      </HelpSection>
    </>
  )
}
