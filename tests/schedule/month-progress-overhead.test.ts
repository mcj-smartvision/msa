import { toGregorian } from 'jalaali-js'
import { describe, expect, it } from 'vitest'
import { enumerateProjectJalaliMonths } from '@/lib/schedule/monthly-deducted-weight'
import {
  allocateOverhead,
  buildProgressAndOverhead,
  monthlyProgressFromCumulative,
} from '@/lib/schedule/month-progress-overhead'

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

describe('monthlyProgressFromCumulative', () => {
  it('treats the month before the first as zero', () => {
    expect(monthlyProgressFromCumulative([0.2, 0.2, 0.7, 1])).toEqual([0.2, 0, 0.5, 0.3])
  })
})

describe('allocateOverhead', () => {
  it('returns zeros instead of dividing by zero', () => {
    expect(allocateOverhead(1000, [0, 0])).toEqual([0, 0])
  })

  it('splits cost by weight and keeps the sum exact', () => {
    expect(allocateOverhead(1000, [2, 8])).toEqual([200, 800])
  })
})

describe('buildProgressAndOverhead', () => {
  it('builds planned and earned weights and allocates overhead for variance', () => {
    const start = gregorianIso(1405, 3, 1)
    const finish = dayBefore(gregorianIso(1405, 5, 1))
    const months = enumerateProjectJalaliMonths(start, finish)
    expect(months.map((month) => month.key)).toEqual(['1405-03', '1405-04'])

    const result = buildProgressAndOverhead(
      [
        {
          activityId: 'a',
          weightFactor: 20,
          start,
          finish,
          actualCumulativePercent: [50, 100],
        },
        {
          activityId: 'b',
          weightFactor: 10,
          start,
          finish,
          actualCumulativePercent: [null, 100],
        },
      ],
      months,
      [1500, 1500]
    )

    const a = result.activities.filter((row) => row.activityId === 'a')
    const b = result.activities.filter((row) => row.activityId === 'b')

    expect(a[0]?.plannedMonthlyProgress).toBe(a[0]?.cumulativePlannedProgress)
    expect(a[1]?.plannedMonthlyProgress).toBe(
      Math.round(((a[1]?.cumulativePlannedProgress ?? 0) - (a[0]?.cumulativePlannedProgress ?? 0)) * 10000) /
        10000
    )
    expect(a.reduce((sum, row) => sum + row.plannedWeightMonth, 0)).toBe(20)
    expect(b.reduce((sum, row) => sum + row.plannedWeightMonth, 0)).toBe(10)
    expect(a[0]?.plannedWeightMonth).toBeCloseTo(20 * (a[0]?.plannedMonthlyProgress ?? 0), 4)

    expect(a.map((row) => row.actualMonthlyProgress)).toEqual([0.5, 0.5])
    expect(a.map((row) => row.earnedWeightMonth)).toEqual([10, 10])
    expect(b.map((row) => row.actualMonthlyProgress)).toEqual([0, 1])
    expect(b.map((row) => row.earnedWeightMonth)).toEqual([0, 10])

    expect(result.totals.map((row) => row.totalEarnedWeightMonth)).toEqual([10, 20])
    expect(result.totals[0]?.totalPlannedWeightMonth).toBeCloseTo(
      (a[0]?.plannedWeightMonth ?? 0) + (b[0]?.plannedWeightMonth ?? 0),
      4
    )

    const monthCost = 1500
    for (const index of [0, 1]) {
      const totalPlanned = result.totals[index]?.totalPlannedWeightMonth ?? 0
      expect(a[index]?.plannedActivityOverhead).toBeCloseTo(
        monthCost * ((a[index]?.plannedWeightMonth ?? 0) / totalPlanned),
        2
      )
      expect(b[index]?.plannedActivityOverhead).toBeCloseTo(
        monthCost * ((b[index]?.plannedWeightMonth ?? 0) / totalPlanned),
        2
      )
      expect((a[index]?.plannedActivityOverhead ?? 0) + (b[index]?.plannedActivityOverhead ?? 0)).toBe(
        monthCost
      )
    }
    expect(a.map((row) => row.actualActivityOverhead)).toEqual([1500, 750])
    expect(b.map((row) => row.actualActivityOverhead)).toEqual([0, 750])
    expect(result.totals.map((row) => row.actualOverhead)).toEqual([1500, 1500])
  })

  it('uses the planned split when the month has no earned weight', () => {
    const start = gregorianIso(1405, 3, 1)
    const finish = dayBefore(gregorianIso(1405, 4, 1))
    const months = enumerateProjectJalaliMonths(start, finish)

    const result = buildProgressAndOverhead(
      [
        {
          activityId: 'a',
          weightFactor: 4,
          start,
          finish,
          actualCumulativePercent: [null],
        },
        {
          activityId: 'b',
          weightFactor: 6,
          start,
          finish,
          actualCumulativePercent: [null],
        },
      ],
      months,
      [100]
    )

    const overhead = result.activities.map((row) => row.actualActivityOverhead)
    expect(result.totals[0]?.totalEarnedWeightMonth).toBe(0)
    expect(overhead).toEqual([40, 60])
  })
})
