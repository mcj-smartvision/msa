import { toGregorian } from 'jalaali-js'
import { describe, expect, it } from 'vitest'
import { earnedWeightsOnMonths } from '@/lib/schedule/earned-month-weight'
import { enumerateProjectJalaliMonths } from '@/lib/schedule/monthly-deducted-weight'
import { accumulateMonthlyProjectProgress } from '@/lib/schedule/monthly-project-progress'
import { plannedWeightsOnMonths } from '@/lib/schedule/planned-month-weight'

function gregorianIso(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd)
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const prev = new Date(Date.UTC(y!, m! - 1, d!) - 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`
}

describe('S-curve when actual duration runs past the baseline', () => {
  it('keeps Planned inside Mordad–Shahrivar and spreads Earned through Aban', () => {
    const mordadStart = gregorianIso(1405, 5, 1)
    const shahrivarStart = gregorianIso(1405, 6, 1)
    const shahrivarEnd = dayBefore(gregorianIso(1405, 7, 1))
    const mehrStart = gregorianIso(1405, 7, 1)
    const abanStart = gregorianIso(1405, 8, 1)
    const weight = 10

    const months = enumerateProjectJalaliMonths(mordadStart, abanStart)
    expect(months.map((month) => month.key)).toEqual(['1405-05', '1405-06', '1405-07', '1405-08'])

    const planned = plannedWeightsOnMonths(weight, mordadStart, shahrivarEnd, months)
    const earned = earnedWeightsOnMonths(
      weight,
      [
        { snapshotMonth: mordadStart, jalaliMonth: '1405-05-01', cumulativePercent: 20 },
        { snapshotMonth: shahrivarStart, jalaliMonth: '1405-06-01', cumulativePercent: 40 },
        { snapshotMonth: mehrStart, jalaliMonth: '1405-07-01', cumulativePercent: 70 },
        { snapshotMonth: abanStart, jalaliMonth: '1405-08-01', cumulativePercent: 100 },
      ],
      months
    )

    expect(planned[0]).toBeGreaterThan(0)
    expect(planned[1]).toBeGreaterThan(0)
    expect(planned[2]).toBe(0)
    expect(planned[3]).toBe(0)
    expect(planned.reduce((sum, value) => sum + value, 0)).toBe(weight)

    expect(earned).toEqual([2, 2, 3, 3])
    expect(earned.reduce((sum, value) => sum + (value ?? 0), 0)).toBe(weight)

    const curve = accumulateMonthlyProjectProgress(
      months.map((month, index) => ({
        month: month.startIso,
        plannedWeight: planned[index] ?? 0,
        earnedWeight: earned[index] ?? null,
      }))
    )

    expect(curve.map((row) => row.plannedCumulative)).toEqual([planned[0], weight, weight, weight])
    expect(curve.map((row) => row.earnedCumulative)).toEqual([2, 4, 7, 10])
  })
})
