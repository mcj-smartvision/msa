import { describe, expect, it } from 'vitest'
import { allocateExecutedByMonths, buildContractorMonthlyCostModel } from '@/lib/finance/contractor-monthly-cost'
import { enumerateProjectJalaliMonths } from '@/lib/schedule/monthly-deducted-weight'

describe('contractor monthly cost', () => {
  it('spreads executed cost across the activity months', () => {
    const months = enumerateProjectJalaliMonths('2026-03-21', '2026-05-21')
    const allocated = allocateExecutedByMonths(90, '2026-03-21', '2026-05-21', months)
    expect(allocated.reduce((sum, value) => sum + value, 0)).toBeCloseTo(90, 5)
    expect(allocated.some((value) => value > 0)).toBe(true)
  })

  it('groups rows by contractor', () => {
    const months = enumerateProjectJalaliMonths('2026-03-21', '2026-04-20')
    const model = buildContractorMonthlyCostModel({
      months,
      rows: [
        {
          contractorId: 'c1',
          contractorName: 'آلفا',
          contractValue: 100,
          executed: 40,
          start: '2026-03-21',
          finish: '2026-04-20',
        },
        {
          contractorId: 'c1',
          contractorName: 'آلفا',
          contractValue: 50,
          executed: 10,
          start: '2026-03-21',
          finish: '2026-04-20',
        },
      ],
    })
    expect(model.contractors).toHaveLength(1)
    expect(model.grandTotal).toBe(50)
    expect(model.contractValue).toBe(150)
  })
})
