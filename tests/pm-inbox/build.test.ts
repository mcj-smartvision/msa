import { describe, expect, it } from 'vitest'
import type { ControlsSnapshot, ExplainedKpi, KpiStatus, SnapshotField } from '@/shared/types/project-controls'
import { buildPmInboxItems, nextWeekStart } from '@/features/project-manager/lib/pm-inbox/build'
import type { DailyReportPulse, PmInboxSnapshot } from '@/features/project-manager/lib/pm-inbox/types'

const AS_OF = '2026-10-03'

function ok<T>(value: T, source = 'src'): SnapshotField<T> {
  return { value, quality: 'ok', source, asOf: AS_OF }
}

function kpi(key: string, value: number | null, opts: { status?: KpiStatus; unit?: string; reason?: string } = {}): ExplainedKpi {
  return {
    key,
    title_fa: key,
    value,
    unit: opts.unit ?? 'ضریب',
    formula: `${key} = …`,
    substitution: `${key} = ${value}`,
    interpretation_fa: '',
    status: opts.status ?? (value == null ? 'gray' : 'green'),
    data_quality: value == null ? 'missing' : 'ok',
    evidence: { sources: [`source:${key}`], asOf: AS_OF },
    reason_fa: value == null ? opts.reason ?? 'داده نیست' : undefined,
  }
}

function controls(overrides: Partial<ControlsSnapshot> = {}): ControlsSnapshot {
  return {
    projectId: 'p1',
    asOf: AS_OF,
    generatedAt: `${AS_OF}T08:00:00Z`,
    periodUnit: 'months',
    daysPerUnit: 30.44,
    budgetBasis: 'contract_value',
    progressBasis: 'schedule_weight',
    bac: ok(1000),
    pv: ok(60),
    ev: ok(55),
    evCost: ok(550),
    ac: ok(500),
    lastCostDate: ok('2026-10-01'),
    pvCurve: ok([]),
    projectStart: ok('2026-01-01'),
    baselineFinish: ok('2027-01-01'),
    plannedDuration: ok(12),
    actualTime: ok(9),
    earnedSchedule: ok(8.9),
    weeklyPlan: ok({ planned: 10, completed: 9, weekStart: '2026-09-26', weekEnd: '2026-10-02' }),
    weightIssues: [],
    ...overrides,
  }
}

const healthyKpis: Record<string, ExplainedKpi> = {
  spi_t: kpi('spi_t', 0.99),
  sv_t: kpi('sv_t', -0.1, { unit: 'ماه' }),
  es: kpi('es', 8.9),
  at: kpi('at', 9),
  delay_forecast: kpi('delay_forecast', 3, { unit: 'روز' }),
  tcpi_bac: kpi('tcpi_bac', 0.9),
  ppc: kpi('ppc', 90, { unit: 'درصد' }),
}

const freshReport: DailyReportPulse = { status: 'fresh', lastActivityAt: `${AS_OF}T06:00:00Z`, thresholdHours: 24, responsible: ['سرپرست'], reason: null }

function input(over: Partial<PmInboxSnapshot> = {}): PmInboxSnapshot {
  return { projectId: 'p1', today: AS_OF, controls: controls(), kpis: healthyKpis, dailyReport: freshReport, ...over }
}

describe('buildPmInboxItems', () => {
  it('is empty only when no trigger is active', () => {
    expect(buildPmInboxItems(input())).toEqual([])
  })

  it('SPI(t) < 0.9 → recovery directive with Crashing, Fast-Track and critical-path review', () => {
    const items = buildPmInboxItems(input({ kpis: { ...healthyKpis, spi_t: kpi('spi_t', 0.85, { status: 'red' }) } }))
    const item = items.find((i) => i.id.startsWith('spi_t_low'))!
    expect(item).toMatchObject({ title_fa: 'صدور دستور جبرانی برنامه', severity: 'critical', category: 'Controls', owner_role: 'PM', due_date: '2026-10-05' })
    expect(item.suggested_actions.map((a) => a.action_type)).toEqual(['draft', 'draft', 'navigate'])
    expect(item.suggested_actions[0]!.payload).toMatchObject({ strategy: 'crashing', spi_t: 0.85 })
    expect(item.suggested_actions[1]!.payload).toMatchObject({ strategy: 'fast_track' })
    expect(item.trigger.rule).toBe('SPI(t) < 0.9')
    expect(item.evidence.metrics.map((m) => m.key)).toContain('spi_t')
  })

  it('SV(t) strongly negative → delay-cause meeting; severity by slip days', () => {
    const warn = buildPmInboxItems(input({ kpis: { ...healthyKpis, sv_t: kpi('sv_t', -0.6, { unit: 'ماه' }) } }))
    expect(warn.find((i) => i.id.startsWith('sv_t_negative'))).toMatchObject({ severity: 'warning', title_fa: 'جلسهٔ فوری تحلیل علل تأخیر' })
    const crit = buildPmInboxItems(input({ kpis: { ...healthyKpis, sv_t: kpi('sv_t', -6.19, { unit: 'ماه' }) } }))
    const item = crit.find((i) => i.id.startsWith('sv_t_negative'))!
    expect(item.severity).toBe('critical')
    expect(item.trigger.observed_fa).toContain('روز')
    const small = buildPmInboxItems(input({ kpis: { ...healthyKpis, sv_t: kpi('sv_t', -0.3, { unit: 'ماه' }) } }))
    expect(small.some((i) => i.id.startsWith('sv_t_negative'))).toBe(false)
  })

  it('PPC missing → register WWP before the week starts, with the API payload ready', () => {
    const items = buildPmInboxItems(input({ kpis: { ...healthyKpis, ppc: kpi('ppc', null, { reason: 'جدول WWP اجرا نشده' }) } }))
    const item = items.find((i) => i.id.startsWith('ppc_missing'))!
    expect(item).toMatchObject({ category: 'LeanOps', owner_role: 'Planner', due_date: '2026-10-03' })
    expect(item.trigger.observed_fa).toBe('جدول WWP اجرا نشده')
    expect(item.suggested_actions[0]).toMatchObject({ action_type: 'api_call', payload: { url: '/api/wwp', body: { projectId: 'p1', weekStart: '2026-10-03' } } })
  })

  it('TCPI > 1.15 → scope/cost and procurement review; 1.15 itself does not fire', () => {
    const items = buildPmInboxItems(input({ kpis: { ...healthyKpis, tcpi_bac: kpi('tcpi_bac', 1.2, { status: 'red' }) } }))
    expect(items.find((i) => i.id.startsWith('tcpi_high'))).toMatchObject({ category: 'Financials', owner_role: 'QS', severity: 'critical' })
    expect(buildPmInboxItems(input({ kpis: { ...healthyKpis, tcpi_bac: kpi('tcpi_bac', 1.15) } }))).toEqual([])
  })

  it('stale or missing daily report → site report reminder wired to /api/manager/remind', () => {
    const stale = buildPmInboxItems(input({ dailyReport: { ...freshReport, status: 'stale', lastActivityAt: '2026-09-28T06:00:00Z' } }))
    const item = stale.find((i) => i.id.startsWith('daily_report_stale'))!
    expect(item).toMatchObject({ owner_role: 'SiteManager', due_date: AS_OF })
    expect(item.suggested_actions[0]).toMatchObject({ action_type: 'api_call', payload: { url: '/api/manager/remind', body: { source: 'daily_report' } } })
    expect(buildPmInboxItems(input({ dailyReport: { ...freshReport, status: 'never', lastActivityAt: null } })).some((i) => i.id.startsWith('daily_report_stale'))).toBe(true)
    expect(buildPmInboxItems(input({ controls: controls({ ev: { ...ok(55), quality: 'stale' } }) })).some((i) => i.id.startsWith('daily_report_stale'))).toBe(true)
  })

  it('data-quality triggers: AC missing, baseline ended, weight issues', () => {
    const items = buildPmInboxItems(
      input({
        controls: controls({ ac: { value: null, quality: 'missing', source: 'cost', asOf: AS_OF, reason_fa: 'AC ثبت نشده' }, baselineFinish: ok('2026-05-10'), weightIssues: ['جمع وزن‌ها ۹۸ است'] }),
      })
    )
    expect(items.map((i) => i.id.split(':')[0])).toEqual(expect.arrayContaining(['ac_missing', 'baseline_ended', 'weight_issues']))
  })

  it('orders critical first, then by due date; every item explains itself', () => {
    const items = buildPmInboxItems(
      input({
        kpis: { ...healthyKpis, spi_t: kpi('spi_t', 0.307), sv_t: kpi('sv_t', -6.19, { unit: 'ماه' }), ppc: kpi('ppc', null) },
        dailyReport: { ...freshReport, status: 'stale' },
      })
    )
    const order = { critical: 0, warning: 1, info: 2 }
    for (let i = 1; i < items.length; i++) expect(order[items[i - 1]!.severity]).toBeLessThanOrEqual(order[items[i]!.severity])
    for (const item of items) {
      expect(item.trigger.rule_fa.length).toBeGreaterThan(0)
      expect(item.trigger.observed_fa.length).toBeGreaterThan(0)
      expect(item.evidence.sources.length).toBeGreaterThan(0)
      expect(item.suggested_actions.length).toBeGreaterThan(0)
    }
  })

  it('nextWeekStart returns the Saturday on or after a date', () => {
    expect(nextWeekStart('2026-10-03')).toBe('2026-10-03')
    expect(nextWeekStart('2026-10-04')).toBe('2026-10-10')
    expect(nextWeekStart('2026-10-09')).toBe('2026-10-10')
  })
})
