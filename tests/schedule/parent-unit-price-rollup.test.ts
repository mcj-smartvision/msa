import { describe, expect, it } from 'vitest'
import {
applyParentUnitPriceSum,
commercialLineAmount,
quantityTimesUnitPrice,
} from '@/features/schedule/lib/parent-unit-price-rollup'

describe('commercialLineAmount', () => {
  it('multiplies qty × unit price', () => {
    expect(commercialLineAmount(10, 5)).toBe(50)
  })
  it('falls back to unit price when qty missing', () => {
    expect(commercialLineAmount(null, 20)).toBe(20)
  })
})

describe('quantityTimesUnitPrice', () => {
  it('always multiplies مقدار × قیمت واحد', () => {
    expect(quantityTimesUnitPrice(10, 10)).toBe(100)
    expect(quantityTimesUnitPrice(null, 10)).toBe(0)
    expect(quantityTimesUnitPrice(10, null)).toBe(0)
  })
})

describe('applyParentUnitPriceSum', () => {
  it('sums package children onto parent task', () => {
    const result = applyParentUnitPriceSum([
      { id: 't4', wbs: '4', name: 'فونداسیون', amount: 0 },
      { id: 't41', wbs: '4.1', name: 'آرماتور', amount: 0 },
      { id: 'p1', wbs: '4.1.1', name: 'زیر۱', amount: commercialLineAmount(100, 2) },
      { id: 'p2', wbs: '4.1.2', name: 'زیر۲', amount: commercialLineAmount(50, 4) },
      { id: 't42', wbs: '4.2', name: 'بتن', amount: commercialLineAmount(10, 10) },
    ])

    expect(result.parentIds.has('t41')).toBe(true)
    expect(result.parentIds.has('t4')).toBe(true)
    expect(result.amounts.p1).toBe(200)
    expect(result.amounts.p2).toBe(200)
    expect(result.amounts.t41).toBe(400)
    expect(result.amounts.t42).toBe(100)
    expect(result.amounts.t4).toBe(500)
  })
})
