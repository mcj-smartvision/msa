import { describe, expect, it } from 'vitest'
import { breakdownActivities, computeEvmMetrics, type EvmActivity } from '@/lib/evm/metrics'
import type { ProjectEvmSnapshot } from '@/lib/evm/load-project-evm'
import { buildControlsSnapshot } from '@/lib/project-controls/controls-snapshot'
import { buildEvForecast, pvAtPeriod } from '@/lib/project-controls/ev-forecast'
import { buildEarnedScheduleKpis } from '@/lib/project-controls/kpis'
import { NOOR_ACTIVITIES, NOOR_PROJECT_ID, NOOR_STATUS_DATE } from '../fixtures/noor-2026-10-03'

const NOW = new Date('2026-10-03T08:00:00.000Z')

function snapshotOf(activities: EvmActivity[]) {
  const metrics = computeEvmMetrics({ activities, costs: [], asOf: NOOR_STATUS_DATE, budgetBasis: 'contract_value' })
  const rows = breakdownActivities(activities, NOOR_STATUS_DATE).map((row, i) => ({ ...row, weight: activities[i]!.weight }))
  const evm = { projectId: NOOR_PROJECT_ID, metrics, activities: rows, weightIssues: [] } as unknown as ProjectEvmSnapshot
  const snapshot = buildControlsSnapshot({ evm, periodUnit: 'months', now: NOW })
  return { snapshot, kpis: buildEarnedScheduleKpis(snapshot) }
}

// Jalali month ends after the status date (Aban … Bahman 1405).
const MONTH_ENDS = ['2026-11-21', '2026-12-21', '2027-01-20', '2027-02-19', '2027-03-20']

describe('EV forecast on the S-curve (Noor, 2026-10-03)', () => {
  const { snapshot, kpis } = snapshotOf(NOOR_ACTIVITIES)
  const forecast = buildEvForecast(snapshot, kpis, MONTH_ENDS)

  it('finish = baseline finish + DelayDays from the explainable KPIs', () => {
    expect(forecast.status).toBe('ok')
    if (forecast.status !== 'ok') return
    expect(forecast.baselineFinish).toBe('2026-05-10')
    expect(forecast.delayDays).toBe(287)
    expect(forecast.delayDays).toBe(kpis.delay_forecast.value)
    expect(forecast.finishDate).toBe('2027-02-21')
    expect(forecast.spiT).toBeCloseTo(kpis.spi_t.value!, 3)
    expect(forecast.eacT).toBeCloseTo(kpis.eac_t.value!, 2)
  })

  it('starts at today’s EV, ends at 100 on the finish date, and only samples the given dates in between', () => {
    if (forecast.status !== 'ok') throw new Error('forecast unavailable')
    const dates = forecast.points.map((p) => p.date)
    expect(dates).toEqual(['2026-10-03', '2026-11-21', '2026-12-21', '2027-01-20', '2027-02-19', '2027-02-21'])
    expect(forecast.points[0]!.earned).toBeCloseTo(74.05, 9)
    expect(forecast.points.at(-1)!.earned).toBe(100)
    for (let i = 1; i < forecast.points.length; i++) {
      expect(forecast.points[i]!.earned).toBeGreaterThanOrEqual(forecast.points[i - 1]!.earned)
    }
    // The curve is continuous at today: PV_baseline(ES) is today's EV.
    expect(pvAtPeriod(snapshot.pvCurve.value!, snapshot.earnedSchedule.value!)).toBeCloseTo(74.05, 6)
  })

  it('each sampled EV is the baseline PV at ES + elapsed × SPI(t)', () => {
    if (forecast.status !== 'ok') throw new Error('forecast unavailable')
    const point = forecast.points.find((p) => p.date === '2026-11-21')!
    const esAt = forecast.earnedSchedule + (49 / forecast.daysPerUnit) * forecast.spiT
    expect(point.earned).toBeCloseTo(pvAtPeriod(snapshot.pvCurve.value!, esAt), 9)
  })
})

describe('EV forecast — not drawn without enough data', () => {
  it('no earned value yet: SPI(t) is missing, the reason is reported', () => {
    const { snapshot, kpis } = snapshotOf(NOOR_ACTIVITIES.map((a) => ({ ...a, physicalPercent: 0 })))
    const forecast = buildEvForecast(snapshot, kpis)
    expect(forecast.status).toBe('unavailable')
    if (forecast.status === 'unavailable') expect(forecast.reason_fa.length).toBeGreaterThan(0)
  })

  it('project fully earned: no forecast is needed', () => {
    const { snapshot, kpis } = snapshotOf(NOOR_ACTIVITIES.map((a) => ({ ...a, physicalPercent: 100 })))
    expect(buildEvForecast(snapshot, kpis).status).toBe('unavailable')
  })

  it('no baseline dates: unavailable', () => {
    const { snapshot, kpis } = snapshotOf(NOOR_ACTIVITIES.map((a) => ({ ...a, baselineStart: null, baselineFinish: null })))
    expect(buildEvForecast(snapshot, kpis).status).toBe('unavailable')
  })
})
