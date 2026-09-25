import { describe, expect, it } from 'vitest'
import { accumulateMonthlyProjectProgress } from '@/lib/schedule/monthly-project-progress'

describe('accumulateMonthlyProjectProgress', () => {
  it('builds planned and earned running totals for an S-curve', () => {
    const rows = accumulateMonthlyProjectProgress([
      { month: '2026-03-21', plannedWeight: 10, earnedWeight: null },
      { month: '2026-04-21', plannedWeight: 0, earnedWeight: 4 },
      { month: '2026-05-22', plannedWeight: 5, earnedWeight: 6 },
    ])

    expect(rows.map((row) => row.plannedCumulative)).toEqual([10, 10, 15])
    expect(rows.map((row) => row.earnedWeight)).toEqual([null, 4, 6])
    expect(rows.map((row) => row.earnedCumulative)).toEqual([null, 4, 10])
  })
})
