import { describe, expect, it } from 'vitest'
import {
  accrueOverheadAsOf,
  buildLiveWorkshopCostModel,
  contractorExecutedAsOf,
} from '@/lib/finance/live-workshop-cost'

const months = [
  {
    startIso: '2026-03-21',
    endIso: '2026-04-20',
    label: 'فروردین 1405',
    amountToman: 100_000_000,
  },
  {
    startIso: '2026-04-21',
    endIso: '2026-05-21',
    label: 'اردیبهشت 1405',
    amountToman: 200_000_000,
  },
]

describe('live workshop cost', () => {
  it('takes closed months in full and prorates the open month', () => {
    const accrued = accrueOverheadAsOf(months, '2026-04-25', '2026-04-25')
    expect(accrued.exact).toBe(100_000_000)
    expect(accrued.estimated).toBeGreaterThan(0)
    expect(accrued.estimated).toBeLessThan(200_000_000)
  })

  it('uses supervisor percent for contractor executed cost', () => {
    expect(
      contractorExecutedAsOf(
        [
          {
            id: 'a',
            contractValue: 1_000_000,
            currentPercent: 70,
            start: '2026-03-21',
            finish: '2026-06-21',
            progressHistory: [],
          },
        ],
        '2026-04-25',
        '2026-04-25'
      )
    ).toBe(700_000)
  })

  it('builds a breakdown that sums to the hero total', () => {
    const model = buildLiveWorkshopCostModel({
      overheadMonths: months,
      activities: [
        {
          id: 'a',
          contractValue: 500_000,
          currentPercent: 50,
          start: '2026-03-21',
          finish: '2026-06-21',
          progressHistory: [],
        },
      ],
      todayIso: '2026-04-20',
    })
    const sum = model.breakdown.reduce((total, row) => total + row.amount, 0)
    expect(Math.round(sum)).toBe(Math.round(model.total))
  })
})
