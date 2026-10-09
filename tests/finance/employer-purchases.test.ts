import { describe, expect, it } from 'vitest'
import {
  equalShares,
  parseEmployerPurchaseInput,
  purchaseCostByTask,
  type EmployerPurchase,
} from '@/features/finance/lib/employer-purchases'

const base = { purchaseDate: '2026-10-08', itemName: 'میلگرد ۱۶', amount: '1,000,000' }

describe('parseEmployerPurchaseInput', () => {
  it('gives a single activity 100 % whatever share was typed', () => {
    const input = parseEmployerPurchaseInput({ ...base, allocations: [{ taskId: 'a', sharePercent: 40 }] })
    expect(input.amount).toBe(1_000_000)
    expect(input.allocations).toEqual([{ taskId: 'a', sharePercent: 100 }])
  })

  it('requires several shares to add up to 100 %', () => {
    const ok = parseEmployerPurchaseInput({
      ...base,
      allocations: [
        { taskId: 'a', sharePercent: 60 },
        { taskId: 'b', sharePercent: '40' },
      ],
    })
    expect(ok.allocations.map((a) => a.sharePercent)).toEqual([60, 40])
    expect(() =>
      parseEmployerPurchaseInput({
        ...base,
        allocations: [
          { taskId: 'a', sharePercent: 60 },
          { taskId: 'b', sharePercent: 30 },
        ],
      })
    ).toThrow(/۱۰۰ درصد/)
  })

  it('rejects a zero share, a repeated activity and a purchase with no activity', () => {
    const two = (a: number, b: number, idB = 'b') => ({ ...base, allocations: [{ taskId: 'a', sharePercent: a }, { taskId: idB, sharePercent: b }] })
    expect(() => parseEmployerPurchaseInput(two(100, 0))).toThrow()
    expect(() => parseEmployerPurchaseInput(two(50, 50, 'a'))).toThrow(/دو بار/)
    expect(() => parseEmployerPurchaseInput({ ...base, allocations: [] })).toThrow(/دست‌کم/)
  })

  it('takes quantity × unit price when no amount is given', () => {
    const input = parseEmployerPurchaseInput({
      purchaseDate: '2026-10-08',
      itemName: 'سیمان',
      quantity: 12.5,
      unitPrice: '80,000',
      allocations: [{ taskId: 'a' }],
    })
    expect(input.amount).toBe(1_000_000)
  })
})

describe('equalShares', () => {
  it('splits into shares that add up to exactly 100', () => {
    expect(equalShares(3)).toEqual([33.33, 33.33, 33.34])
    expect(equalShares(4)).toEqual([25, 25, 25, 25])
  })
})

describe('purchaseCostByTask', () => {
  it('shares each purchase by percent, keeping its total exact, and sums per activity', () => {
    const purchase = (id: string, amount: number, allocations: EmployerPurchase['allocations']): EmployerPurchase => ({
      id,
      purchaseDate: '2026-10-08',
      itemName: id,
      supplier: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      amount,
      invoiceRef: null,
      description: null,
      allocations,
    })
    const a = { taskId: 'a', taskWbs: '4.1', taskName: 'آرماتوربندی' }
    const b = { taskId: 'b', taskWbs: '4.2', taskName: 'قالب‌بندی' }
    const byTask = purchaseCostByTask([
      purchase('p1', 1000, [
        { ...a, sharePercent: 33.33 },
        { ...b, sharePercent: 66.67 },
      ]),
      purchase('p2', 500, [{ ...a, sharePercent: 100 }]),
    ])
    expect(byTask.get('a')?.amount).toBe(333 + 500)
    expect(byTask.get('b')?.amount).toBe(667)
  })
})
