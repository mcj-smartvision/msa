import { describe, expect, it } from 'vitest'
import { enumerateProjectJalaliMonths } from '@/lib/schedule/monthly-deducted-weight'
import { plannedMonthlyWeights } from '@/lib/schedule/planned-month-weight'

describe('plannedMonthlyWeights', () => {
  it('splits weight by inclusive start and finish days', () => {
    // 2026-04-11 through 2026-05-10 inclusive = 30 days: 10 in Farvardin, 20 in Ordibehesht
    const months = enumerateProjectJalaliMonths('2026-04-11', '2026-05-10')
    const slices = plannedMonthlyWeights(30, '2026-04-11', '2026-05-10', months)
    const byLabel = new Map(slices.map((slice) => [slice.jalaliMonth, slice]))

    expect(byLabel.get('1405-01-01')?.overlapDays).toBe(10)
    expect(byLabel.get('1405-02-01')?.overlapDays).toBe(20)
    expect(byLabel.get('1405-01-01')?.plannedWeight).toBe(10)
    expect(byLabel.get('1405-02-01')?.plannedWeight).toBe(20)
    expect(slices.reduce((sum, slice) => sum + slice.plannedWeight, 0)).toBe(30)
  })

  it('counts the finish day, so Tir 1 through Mordad 10 is 31 + 10 days', () => {
    const months = enumerateProjectJalaliMonths('2026-06-22', '2026-08-01')
    const slices = plannedMonthlyWeights(7, '2026-06-22', '2026-08-01', months)
    const byLabel = new Map(slices.map((slice) => [slice.jalaliMonth, slice]))
    expect(byLabel.get('1405-04-01')?.overlapDays).toBe(31)
    expect(byLabel.get('1405-05-01')?.overlapDays).toBe(10)
    expect(slices.reduce((sum, slice) => sum + slice.overlapDays, 0)).toBe(41)
    expect(slices.reduce((sum, slice) => sum + slice.plannedWeight, 0)).toBe(7)
  })

  it('puts a same-day baseline on that single day', () => {
    const months = enumerateProjectJalaliMonths('2026-07-23', '2026-07-23')
    const slices = plannedMonthlyWeights(5, '2026-07-23', '2026-07-23', months)
    expect(slices).toHaveLength(1)
    expect(slices[0]?.jalaliMonth).toBe('1405-05-01')
    expect(slices[0]?.plannedWeight).toBe(5)
  })

  it('returns nothing without a baseline', () => {
    const months = enumerateProjectJalaliMonths('2026-04-01', '2026-05-01')
    expect(plannedMonthlyWeights(10, null, '2026-05-01', months)).toEqual([])
  })
})
