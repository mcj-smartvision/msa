/**
 * @file features/project-manager/lib/pm-inbox/build.ts
 * @purpose منطق دامنه — اتاق فرمان مدیر پروژه و کارتابل (build)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on shared/types/project-controls, features/project-manager/lib/pm-inbox/types, features/manager/lib/format, features/project-manager/lib/pm-inbox/messages
 */

import type { ExplainedKpi } from '@/shared/types/project-controls'
import type { InboxEvidenceMetric, InboxItem, InboxSeverity, PmInboxSnapshot } from '@/features/project-manager/lib/pm-inbox/types'
import { jalaliDate } from '@/features/manager/lib/format'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getActiveLocale } from '@/shared/lib/i18n/active-locale'
import { getInboxMessages } from '@/features/project-manager/lib/pm-inbox/messages'

export const PM_INBOX_THRESHOLDS = {
  /** SPI(t) below this needs a recovery directive (same as the KPI's critical band). */
  spiT: 0.9,
  /** Schedule slip (−SV(t) in calendar days) that calls for a delay-cause meeting / makes it urgent. */
  slipWarningDays: 14,
  slipCriticalDays: 30,
  /** TCPI above this means the remaining budget is not achievable without a scope/cost review. */
  tcpi: 1.15,
} as const

const SEVERITY_ORDER: Record<InboxSeverity, number> = { critical: 0, warning: 1, info: 2 }
const DAY_MS = 86_400_000

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** The Saturday that starts the work week on or after `iso` (today when today is Saturday). */
export function nextWeekStart(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return addDays(iso, (6 - dow + 7) % 7)
}

const fmt = (x: number, digits = 2) => x.toLocaleString('fa-IR-u-nu-latn', { maximumFractionDigits: digits })

function metricOf(kpi: ExplainedKpi): InboxEvidenceMetric {
  return { key: kpi.key, label_fa: kpi.title_fa, value: kpi.value, unit: kpi.unit, data_quality: kpi.data_quality }
}

function sourcesOf(...kpis: ExplainedKpi[]): string[] {
  return Array.from(new Set(kpis.flatMap((k) => k.evidence.sources)))
}

/**
 * Turns KPI values and data-quality signals into actionable PM items. Every item records the rule
 * that fired and the observed value, so the inbox explains itself. Pure: no I/O, no clock.
 */
export function buildPmInboxItems(snapshot: PmInboxSnapshot, locale?: FormLocale): InboxItem[] {
  const t = getInboxMessages(locale ?? getActiveLocale())
  const { controls, kpis, today, projectId } = snapshot
  const asOf = controls.asOf
  const id = (rule: string) => `${rule}:${projectId}:${asOf}`
  const items: InboxItem[] = []
  const T = PM_INBOX_THRESHOLDS

  const spiT = kpis.spi_t
  if (spiT?.value != null && spiT.value < T.spiT) {
    items.push({
      id: id('spi_t_low'),
      category: 'Controls',
      title_fa: t.spiTitle,
      description_fa: t.spiBody(fmt(spiT.value, 3)),
      severity: 'critical',
      owner_role: 'PM',
      due_date: addDays(today, 2),
      trigger: { rule: `SPI(t) < ${T.spiT}`, rule_fa: t.spiRule(fmt(T.spiT)), observed_fa: spiT.substitution },
      suggested_actions: [
        { label_fa: t.draftCrash, action_type: 'draft', payload: { kind: 'schedule_recovery_directive', strategy: 'crashing', projectId, spi_t: spiT.value, asOf } },
        { label_fa: t.draftFast, action_type: 'draft', payload: { kind: 'schedule_recovery_directive', strategy: 'fast_track', projectId, spi_t: spiT.value, asOf } },
        { label_fa: t.reviewCritical, action_type: 'navigate', payload: { route: 'scheduleIntel', query: { projectId, focus: 'critical_path' } } },
      ],
      evidence: { metrics: [metricOf(spiT), ...(kpis.es ? [metricOf(kpis.es)] : []), ...(kpis.at ? [metricOf(kpis.at)] : [])], sources: sourcesOf(spiT), asOf: spiT.evidence.asOf },
    })
  }

  const svT = kpis.sv_t
  if (svT?.value != null) {
    const slipDays = Math.round(-svT.value * controls.daysPerUnit)
    if (slipDays >= T.slipWarningDays) {
      const critical = slipDays >= T.slipCriticalDays
      items.push({
        id: id('sv_t_negative'),
        category: 'Controls',
        title_fa: t.delayTitle,
        description_fa: t.delayBody(fmt(slipDays, 0), fmt(svT.value), svT.unit),
        severity: critical ? 'critical' : 'warning',
        owner_role: 'Planner',
        due_date: addDays(today, critical ? 1 : 3),
        trigger: {
          rule: `−SV(t) × daysPerUnit ≥ ${T.slipWarningDays}`,
          rule_fa: t.delayRule(fmt(T.slipWarningDays, 0), fmt(T.slipCriticalDays, 0)),
          observed_fa: t.delayObserved(fmt(-svT.value), fmt(controls.daysPerUnit), fmt(slipDays, 0)),
        },
        suggested_actions: [
          { label_fa: t.delayMeeting, action_type: 'draft', payload: { kind: 'delay_analysis_meeting', projectId, slipDays, attendees: ['PM', 'Planner', 'SiteManager'], asOf } },
          { label_fa: t.viewLate, action_type: 'navigate', payload: { route: 'gantt', query: { projectId } } },
        ],
        evidence: { metrics: [metricOf(svT), ...(kpis.delay_forecast ? [metricOf(kpis.delay_forecast)] : [])], sources: sourcesOf(svT), asOf: svT.evidence.asOf },
      })
    }
  }

  const ppc = kpis.ppc
  if (ppc && (ppc.data_quality === 'missing' || ppc.data_quality === 'invalid')) {
    const weekStart = nextWeekStart(today)
    items.push({
      id: id('ppc_missing'),
      category: 'LeanOps',
      title_fa: t.ppcTitle,
      description_fa: t.ppcBody(jalaliDate(weekStart)),
      severity: 'warning',
      owner_role: 'Planner',
      due_date: weekStart,
      trigger: { rule: 'PPC.data_quality ∈ {missing, invalid}', rule_fa: t.ppcRule, observed_fa: ppc.reason_fa ?? ppc.interpretation_fa },
      suggested_actions: [
        { label_fa: t.draftWwp, action_type: 'api_call', payload: { method: 'POST', url: '/api/wwp', body: { projectId, weekStart } } },
      ],
      evidence: { metrics: [metricOf(ppc)], sources: sourcesOf(ppc), asOf: ppc.evidence.asOf },
    })
  }

  const tcpi = kpis.tcpi_bac
  if (tcpi?.value != null && tcpi.value > T.tcpi) {
    items.push({
      id: id('tcpi_high'),
      category: 'Financials',
      title_fa: t.tcpiTitle,
      description_fa: t.tcpiBody(fmt(tcpi.value, 3)),
      severity: 'critical',
      owner_role: 'QS',
      due_date: addDays(today, 5),
      trigger: { rule: `TCPI > ${T.tcpi}`, rule_fa: t.tcpiRule(fmt(T.tcpi)), observed_fa: tcpi.substitution },
      suggested_actions: [
        { label_fa: t.reviewCosts, action_type: 'navigate', payload: { route: 'finance', query: { projectId } } },
        { label_fa: t.reviewBuy, action_type: 'navigate', payload: { route: 'procurement', query: { projectId } } },
        { label_fa: t.draftScope, action_type: 'draft', payload: { kind: 'scope_change_request', projectId, tcpi: tcpi.value, asOf } },
      ],
      evidence: { metrics: [metricOf(tcpi)], sources: sourcesOf(tcpi), asOf: tcpi.evidence.asOf },
    })
  }

  const daily = snapshot.dailyReport
  const progressStale = controls.ev.quality === 'stale'
  if ((daily && (daily.status === 'stale' || daily.status === 'never')) || progressStale) {
    const observed = [
      daily?.status === 'never' ? t.dailyNever : null,
      daily?.status === 'stale' ? t.dailyStale(jalaliDate(daily.lastActivityAt), fmt(daily.thresholdHours, 0)) : null,
      progressStale ? t.progressStale(jalaliDate(controls.ev.asOf)) : null,
    ].filter(Boolean) as string[]
    const who = daily?.responsible.length ? t.dailyOwner(daily.responsible.join(localeIsFa(locale) ? '، ' : ', ')) : ''
    items.push({
      id: id('daily_report_stale'),
      category: 'Controls',
      title_fa: t.dailyTitle,
      description_fa: t.dailyBody(who),
      severity: 'warning',
      owner_role: 'SiteManager',
      due_date: today,
      trigger: { rule: 'daily_report.status ∈ {stale, never} ∨ EV.quality = stale', rule_fa: t.dailyRule, observed_fa: observed.join(' · ') },
      suggested_actions: [
        { label_fa: t.remindSupervisor, action_type: 'api_call', payload: { method: 'POST', url: '/api/manager/remind', body: { projectId, source: 'daily_report' } } },
      ],
      evidence: {
        metrics: [
          { key: 'daily_report', label_fa: t.lastDaily, value: daily?.lastActivityAt ?? null, data_quality: daily?.status === 'fresh' ? 'ok' : daily?.status === 'never' ? 'missing' : 'stale' },
          { key: 'ev', label_fa: t.evPct, value: controls.ev.value, unit: t.pctUnit, data_quality: controls.ev.quality },
        ],
        sources: [t.dailySource, controls.ev.source],
        asOf,
      },
    })
  }

  if (controls.ac.value == null && controls.bac.value != null) {
    items.push({
      id: id('ac_missing'),
      category: 'Financials',
      title_fa: t.acTitle,
      description_fa: t.acBody,
      severity: 'info',
      owner_role: 'QS',
      due_date: addDays(today, 7),
      trigger: { rule: 'AC.quality = missing ∧ BAC.quality = ok', rule_fa: t.acRule, observed_fa: controls.ac.reason_fa ?? t.acMissing },
      suggested_actions: [{ label_fa: t.addCost, action_type: 'navigate', payload: { route: 'finance', query: { projectId } } }],
      evidence: {
        metrics: [
          { key: 'ac', label_fa: t.acLabel, value: null, data_quality: controls.ac.quality },
          { key: 'bac', label_fa: t.bacLabel, value: controls.bac.value, data_quality: controls.bac.quality },
        ],
        sources: [controls.ac.source, controls.bac.source],
        asOf,
      },
    })
  }

  const finish = controls.baselineFinish.value
  if (finish && today > finish && (controls.ev.value ?? 0) < 99.95) {
    items.push({
      id: id('baseline_ended'),
      category: 'Controls',
      title_fa: t.rebaselineTitle,
      description_fa: t.rebaselineBody(jalaliDate(finish)),
      severity: 'warning',
      owner_role: 'Planner',
      due_date: addDays(today, 7),
      trigger: {
        rule: 'today > baselineFinish ∧ EV٪ < 100',
        rule_fa: t.rebaselineRule,
        observed_fa: t.rebaselineObserved(jalaliDate(today), jalaliDate(finish), fmt(controls.ev.value ?? 0)),
      },
      suggested_actions: [{ label_fa: t.openSchedule, action_type: 'navigate', payload: { route: 'gantt', query: { projectId } } }],
      evidence: {
        metrics: [
          { key: 'baseline_finish', label_fa: t.baselineFinish, value: finish, data_quality: controls.baselineFinish.quality },
          { key: 'ev', label_fa: t.evPct, value: controls.ev.value, unit: t.pctUnit, data_quality: controls.ev.quality },
        ],
        sources: [controls.baselineFinish.source],
        asOf,
      },
    })
  }

  if (controls.weightIssues.length > 0) {
    items.push({
      id: id('weight_issues'),
      category: 'Controls',
      title_fa: t.weightTitle,
      description_fa: t.weightBody(fmt(controls.weightIssues.length, 0)),
      severity: 'warning',
      owner_role: 'Planner',
      due_date: addDays(today, 3),
      trigger: { rule: 'weightIssues.length > 0', rule_fa: t.weightRule, observed_fa: controls.weightIssues.join(' · ') },
      suggested_actions: [{ label_fa: t.viewWeights, action_type: 'navigate', payload: { route: 'background', query: { projectId } } }],
      evidence: { metrics: [], sources: [controls.pv.source], asOf },
    })
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.due_date.localeCompare(b.due_date))
}

function localeIsFa(locale?: FormLocale): boolean {
  return (locale ?? getActiveLocale()) === 'fa'
}
