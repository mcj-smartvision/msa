import { describe, expect, it } from 'vitest'
import { breakdownActivities, computeEvmMetrics, type EvmCostEntry } from '@/features/evm/lib/metrics'
import type { ProjectEvmSnapshot } from '@/features/evm/lib/load-project-evm'
import { buildControlsSnapshot } from '@/features/project-controls/lib/controls-snapshot'
import { buildAllKpis, buildPpcKpi, buildTcpiKpi } from '@/features/project-controls/lib/kpis'
import { scheduleForecast } from '@/features/manager/lib/progress-curve'
import { NOOR_ACTIVITIES, NOOR_PROJECT_ID, NOOR_STATUS_DATE } from '../fixtures/noor-2026-10-03'

/**
 * Golden values for Noor on 2026-10-03, derived by hand from the weights and baseline dates of
 * the background tables — not from the engine. Rounding matches the engine's display precision
 * (AT/ES/SV(t)/EAC(t) 2 decimals, SPI(t)/TCPI 3, delay whole days, PPC 1).
 *
 * Intentional change in stage پ: SPI moved from the budget basis (EV÷PV in money, 0.847) to the
 * schedule-weight basis (earned% ÷ planned% = 74.05 ÷ 100 = 0.7405), the same basis as «پیشرفت تجمعی».
 */

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d
const NOW = new Date('2026-10-03T08:00:00.000Z')

// Σ wᵢ·pᵢ = 11·45 + 6·65 + 5·100·3 + 7·100 + 4·100 + 2·100 + 7·100 + 9·75 + 11·55 + 8·75 + 3·100·3 + 6·40 + 5·0
const EARNED_PERCENT = (495 + 390 + 1500 + 700 + 400 + 200 + 700 + 675 + 605 + 600 + 900 + 240 + 0) / 100
// Every baseline finishes by 2026-05-10, so the plan is 100% on the status date.
const PLANNED_PERCENT = 100

// Months unit (30.44 days). Baseline start 2026-01-04, finish 2026-05-10.
const DPU = 30.44
const AT_DAYS = 272 // 2026-01-04 → 2026-10-03
const PD_DAYS = 127 // 2026-01-04 … 2026-05-10 inclusive
// PV at t = 2 months = 60.88 days: plan through 2026-03-04 (day 60) + 0.88 of 2026-03-05.
// Done by 03-04: 5+5+5+4+7+2+7+9 = 44; beams/slab (02-24…03-09, 14 days) 9/14 of 11, then +1/14 of 11.
const PV_2 = 44 + (11 * 9) / 14 + (2 * DPU - 60) * (11 / 14)
// PV at t = 3 months = 91.32 days: plan through 2026-04-04 (day 91) + 0.32 of 2026-04-05.
// Done by 04-04: 44 + 11 + 8 + 17 (walls) = 80; plastering (03-30…04-09, 11 days) 6/11 of 3, then +1/11 of 3.
const PV_3 = 80 + (3 * 6) / 11 + (3 * DPU - 91) * (3 / 11)
const ES = 2 + (EARNED_PERCENT - PV_2) / (PV_3 - PV_2)
const AT = AT_DAYS / DPU
const PD = PD_DAYS / DPU
const SPI_T = ES / AT
const SV_T = ES - AT
const EAC_T = PD / SPI_T
const DELAY_DAYS = (EAC_T - PD) * DPU

// Calendar-day ES for the dashboard forecast: between the ends of 2026-03-22 (day 78) and 03-23 (day 79).
const DAY_78 = 55 + (8 * 13) / 14 + (17 * 11) / 18
const DAY_79 = 55 + 8 + (17 * 12) / 18
const ES_DAYS = 78 + (EARNED_PERCENT - DAY_78) / (DAY_79 - DAY_78)

function noorEvm(): ProjectEvmSnapshot {
  const metrics = computeEvmMetrics({ activities: NOOR_ACTIVITIES, costs: [], asOf: NOOR_STATUS_DATE, budgetBasis: 'contract_value' })
  const activities = breakdownActivities(NOOR_ACTIVITIES, NOOR_STATUS_DATE).map((row, i) => ({ ...row, weight: NOOR_ACTIVITIES[i]!.weight }))
  return { projectId: NOOR_PROJECT_ID, metrics, activities, weightIssues: [] } as unknown as ProjectEvmSnapshot
}

describe('Noor golden — PV, EV, SPI on the schedule-weight basis', () => {
  const m = noorEvm().metrics

  it('earned % equals «پیشرفت تجمعی» and SPI = earned% ÷ planned%', () => {
    expect(m.progressBasis).toBe('schedule_weight')
    expect(m.totalWeight).toBe(100)
    expect(m.earnedPercent).toBeCloseTo(EARNED_PERCENT, 12)
    expect(m.earnedPercent).toBeCloseTo(74.05, 12)
    expect(m.plannedPercent).toBe(PLANNED_PERCENT)
    expect(m.spi).toBeCloseTo(0.7405, 12)
  })

  it('money PV/EV scale BAC by the weighted percents; cost EV stays Σ budget × %', () => {
    expect(m.bac).toBe(3300)
    expect(m.pv).toBeCloseTo(3300, 9)
    expect(m.ev).toBeCloseTo(3300 * 0.7405, 9)
    // 200·.45 + 200·.65 + 600 + 400 + 100·5 + 100·.75 + 200·.55 + 200·.75 + 100 + 200 + 400 + 100·.40
    expect(m.evAmount).toBeCloseTo(90 + 130 + 600 + 400 + 500 + 75 + 110 + 150 + 100 + 200 + 400 + 40, 9)
    expect(m.cpi).toBeNull()
  })
})

describe('Noor golden — Earned Schedule (months)', () => {
  const snapshot = buildControlsSnapshot({ evm: noorEvm(), periodUnit: 'months', now: NOW })
  const kpis = buildAllKpis(snapshot)

  it('snapshot inputs match the hand-built PV curve exactly', () => {
    expect(snapshot.projectStart.value).toBe('2026-01-04')
    expect(snapshot.baselineFinish.value).toBe('2026-05-10')
    expect(snapshot.ev.value).toBeCloseTo(EARNED_PERCENT, 12)
    expect(snapshot.plannedDuration.value).toBeCloseTo(PD, 12)
    expect(snapshot.actualTime.value).toBeCloseTo(AT, 12)
    expect(snapshot.pvCurve.value![2]!.cumulativePV).toBeCloseTo(PV_2, 9)
    expect(snapshot.pvCurve.value![3]!.cumulativePV).toBeCloseTo(PV_3, 9)
    expect(snapshot.earnedSchedule.value).toBeCloseTo(ES, 9)
    expect(ES).toBeCloseTo(2.743877, 6)
  })

  it('SPI(t), SV(t), EAC(t) and delay equal the reference formulas', () => {
    expect(kpis.at.value).toBe(round(AT, 2))
    expect(kpis.es.value).toBe(round(ES, 2))
    expect(kpis.spi_t.value).toBe(round(SPI_T, 3))
    expect(kpis.sv_t.value).toBe(round(SV_T, 2))
    expect(kpis.eac_t.value).toBe(round(EAC_T, 2))
    expect(kpis.delay_forecast.value).toBe(round(DELAY_DAYS, 0))
    expect([kpis.spi_t.value, kpis.sv_t.value, kpis.eac_t.value, kpis.delay_forecast.value]).toEqual([0.307, -6.19, 13.59, 287])
    for (const key of ['at', 'es', 'spi_t', 'sv_t', 'eac_t', 'delay_forecast'] as const) {
      expect(kpis[key].data_quality).toBe('ok')
    }
  })

  it('explained EVM KPIs: PV٪, EV٪, SPI; CPI and last cost date are missing without AC', () => {
    expect(kpis.pv.value).toBe(PLANNED_PERCENT)
    expect(kpis.ev.value).toBe(round(EARNED_PERCENT, 2))
    expect(kpis.spi.value).toBe(round(EARNED_PERCENT / PLANNED_PERCENT, 3))
    expect(kpis.spi.status).toBe('red')
    expect(kpis.spi.substitution).toContain('74.05٪ ÷ 100.00٪')
    expect(kpis.cpi).toMatchObject({ value: null, status: 'gray', data_quality: 'missing' })
    expect(snapshot.lastCostDate).toMatchObject({ value: null, quality: 'missing' })
  })

  it('TCPI and PPC are data-missing for Noor (no AC, no WWP) — never a fabricated number', () => {
    expect(kpis.tcpi_bac).toMatchObject({ value: null, status: 'gray', data_quality: 'missing' })
    expect(kpis.ppc).toMatchObject({ value: null, status: 'gray', data_quality: 'missing' })
  })
})

describe('Noor golden — TCPI and PPC formulas on Noor inputs', () => {
  const base = buildControlsSnapshot({ evm: noorEvm(), periodUnit: 'months', now: NOW })

  it('TCPI = (BAC − EV) ÷ (BAC − AC) uses the cost-basis EV', () => {
    const ac = 3000
    const kpi = buildTcpiKpi({ ...base, ac: { value: ac, quality: 'ok', source: 'cost', asOf: NOOR_STATUS_DATE } })
    expect(base.evCost.value).toBeCloseTo(2795, 9)
    expect(kpi.value).toBe(round((3300 - 2795) / (3300 - ac), 3))
    expect(kpi.value).toBe(1.683)
  })

  it('CPI = EV_cost ÷ AC and the last cost date come from recorded costs', () => {
    const costs: EvmCostEntry[] = [
      { source: 'expense', date: '2026-09-01', amount: 1000 },
      { source: 'vendor_bill', date: '2026-09-20', amount: 2000 },
      { source: 'expense', date: '2026-10-10', amount: 500 },
    ]
    const metrics = computeEvmMetrics({ activities: NOOR_ACTIVITIES, costs, asOf: NOOR_STATUS_DATE, budgetBasis: 'contract_value' })
    const evm = { ...noorEvm(), metrics, costs } as unknown as ProjectEvmSnapshot
    const snap = buildControlsSnapshot({ evm, periodUnit: 'months', now: NOW })
    expect(snap.ac.value).toBe(3000)
    expect(snap.lastCostDate.value).toBe('2026-09-20')
    const cpi = buildAllKpis(snap).cpi
    expect(cpi.value).toBe(round(2795 / 3000, 3))
    expect(cpi.status).toBe('yellow')
  })

  it('PPC = completed ÷ planned × 100 over the last closed week', () => {
    const kpi = buildPpcKpi({
      ...base,
      weeklyPlan: {
        value: { planned: 14, completed: 11, weekStart: '2026-09-26', weekEnd: '2026-10-02' },
        quality: 'ok',
        source: 'wwp',
        asOf: '2026-10-02',
      },
    })
    expect(kpi.value).toBe(round((11 / 14) * 100, 1))
    expect(kpi.value).toBe(78.6)
  })
})

describe('Noor golden — dashboard forecast (calendar days) agrees with the engine', () => {
  const evm = noorEvm()
  const f = scheduleForecast(evm.activities, evm.metrics.earnedPercent, NOOR_STATUS_DATE)!
  const daysKpis = buildAllKpis(buildControlsSnapshot({ evm, periodUnit: 'days', now: NOW }))

  it('ES, lag, SPI(t) and both finish forecasts', () => {
    expect(f.actualTimeDays).toBe(AT_DAYS)
    expect(f.plannedDurationDays).toBe(PD_DAYS)
    expect(f.earnedScheduleDays).toBeCloseTo(ES_DAYS, 9)
    expect(f.varianceDays).toBe(Math.round(AT_DAYS - ES_DAYS))
    expect(f.varianceDays).toBe(193)
    expect(f.spiT).toBeCloseTo(ES_DAYS / AT_DAYS, 12)
    expect(f.plannedFinish).toBe('2026-05-10')
    expect(f.forecastFinish).toBe('2026-11-19')
    // today + round((127 − ES) ÷ SPI(t)) = 2026-10-03 + 166
    expect(Math.round((PD_DAYS - ES_DAYS) / (ES_DAYS / AT_DAYS))).toBe(166)
    expect(f.trendFinish).toBe('2027-03-18')
    expect(f.planPeriodEnded).toBe(true)
  })

  it('the engine in days gives the same SPI(t) and SV(t)', () => {
    expect(daysKpis.spi_t.value).toBe(round(f.spiT!, 3))
    expect(daysKpis.sv_t.value).toBe(round(ES_DAYS - AT_DAYS, 2))
    expect(Math.round(-daysKpis.sv_t.value!)).toBe(f.varianceDays)
  })
})
