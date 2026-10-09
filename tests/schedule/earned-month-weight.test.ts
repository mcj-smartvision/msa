import { describe, expect, it } from 'vitest'
import {
earnedMonthlyWeights,
earnedWeightsFromDailyReports,
earnedWeightsFromPhysicalProgress,
} from '@/features/schedule/lib/earned-month-weight'

describe('earnedMonthlyWeights', () => {
  it('uses successive snapshot deltas and ignores gaps and baseline length', () => {
    const slices = earnedMonthlyWeights(20, [
      { snapshotMonth: '2026-08-23', jalaliMonth: '1405-06-01', cumulativePercent: 40 },
      { snapshotMonth: '2026-10-23', jalaliMonth: '1405-08-01', cumulativePercent: 100 },
    ])
    expect(slices.map((slice) => slice.jalaliMonth)).toEqual(['1405-06-01', '1405-08-01'])
    expect(slices[0]?.percentPreviousMonth).toBe(0)
    expect(slices[0]?.earnedWeight).toBe(8)
    expect(slices[1]?.percentPreviousMonth).toBe(40)
    expect(slices[1]?.earnedWeight).toBe(12)
    expect(slices.reduce((sum, slice) => sum + slice.earnedWeight, 0)).toBe(20)
  })

  it('returns nothing without snapshots', () => {
    expect(earnedMonthlyWeights(10, [])).toEqual([])
  })
})

describe('earnedWeightsFromDailyReports', () => {
  const months = [
    { startIso: '2026-05-22', endIso: '2026-06-21' },
    { startIso: '2026-06-22', endIso: '2026-07-22' },
    { startIso: '2026-07-23', endIso: '2026-08-22' },
  ]

  it('multiplies weight by the progress gained in that month', () => {
    const earned = earnedWeightsFromDailyReports(
      20,
      [
        { reportDate: '2026-06-01', percentComplete: 40 },
        { reportDate: '2026-08-01', percentComplete: 100 },
      ],
      months
    )
    expect(earned).toEqual([8, null, 12])
  })

  it('sets earned to weight times physical progress, split like planned', () => {
    expect(earnedWeightsFromPhysicalProgress(5, 100, [5, 0, 0])).toEqual([5, null, null])
    expect(earnedWeightsFromPhysicalProgress(7, 65, [0, 7, 0])).toEqual([null, 4.55, null])
    expect(earnedWeightsFromPhysicalProgress(9, 50, [6, 3])).toEqual([3, 1.5])
    expect(earnedWeightsFromPhysicalProgress(8, 0, [8])).toEqual([0])
    expect(earnedWeightsFromPhysicalProgress(5, null, [5])).toEqual([null])
  })

  it('spreads earned only up to the as-of month and leaves later months empty', () => {
    expect(earnedWeightsFromPhysicalProgress(10, 50, [2, 3, 5], 1)).toEqual([2, 3, null])
    expect(earnedWeightsFromPhysicalProgress(10, 50, [2, 3, 5], 2)).toEqual([1, 1.5, 2.5])
    expect(earnedWeightsFromPhysicalProgress(10, 40, [0, 4, 6], 0)).toEqual([4, null, null])
    expect(earnedWeightsFromPhysicalProgress(10, 40, [4, 0, 6], 1)).toEqual([4, null, null])
    expect(earnedWeightsFromPhysicalProgress(10, 40, [4, 6], 99)).toEqual([1.6, 2.4])
    expect(earnedWeightsFromPhysicalProgress(10, null, [4, 6], 0)).toEqual([null, null])
  })

  it('uses only the latest report inside one month', () => {
    const earned = earnedWeightsFromDailyReports(
      10,
      [
        { reportDate: '2026-06-02', percentComplete: 20 },
        { reportDate: '2026-06-18', percentComplete: 50 },
      ],
      months
    )
    expect(earned).toEqual([5, null, null])
  })
})
