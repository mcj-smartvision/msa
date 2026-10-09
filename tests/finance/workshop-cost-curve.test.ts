import { describe, expect, it } from 'vitest'
import { buildLiveWorkshopCostModel } from '@/features/finance/lib/live-workshop-cost'
import { buildCostCurve, buildItemCosts, type CostActivity } from '@/features/finance/lib/workshop-cost-curve'
import type { EmployerPurchase } from '@/features/finance/lib/employer-purchases'

const TODAY = '2026-05-10'

const months = [
  { startIso: '2026-03-21', endIso: '2026-04-20', label: 'فروردین 1405', amountToman: 100_000_000 },
  { startIso: '2026-04-21', endIso: '2026-05-21', label: 'اردیبهشت 1405', amountToman: 0 },
]

function activity(over: Partial<CostActivity> & Pick<CostActivity, 'id'>): CostActivity {
  return {
    name: over.id,
    wbs: null,
    budget: 0,
    weight: 0,
    baselineStart: null,
    baselineFinish: null,
    physicalPercent: 0,
    contractValue: 0,
    currentPercent: 0,
    start: null,
    finish: null,
    progressHistory: [],
    ...over,
  }
}

const activities: CostActivity[] = [
  activity({
    id: 'A',
    wbs: '1',
    weight: 60,
    budget: 1_000_000,
    contractValue: 1_000_000,
    physicalPercent: 80,
    currentPercent: 80,
    start: '2026-03-21',
    baselineStart: '2026-03-21',
    baselineFinish: '2026-05-31',
    progressHistory: [
      { date: '2026-04-10', percent: 50 },
      { date: '2026-05-05', percent: 80 },
    ],
  }),
  activity({
    id: 'B',
    wbs: '2',
    weight: 40,
    budget: 500_000,
    contractValue: 500_000,
    physicalPercent: 20,
    currentPercent: 20,
    start: '2026-04-21',
    baselineStart: '2026-04-21',
    baselineFinish: '2026-06-30',
    progressHistory: [{ date: '2026-05-01', percent: 20 }],
  }),
]

function purchase(id: string, date: string, amount: number, allocations: EmployerPurchase['allocations']): EmployerPurchase {
  return {
    id,
    purchaseDate: date,
    itemName: id,
    supplier: null,
    quantity: null,
    unit: null,
    unitPrice: null,
    amount,
    invoiceRef: null,
    description: null,
    allocations,
  }
}

const purchases = [
  purchase('rebar', '2026-04-01', 10_000_000, [
    { taskId: 'A', taskWbs: '1', taskName: 'A', sharePercent: 60 },
    { taskId: 'B', taskWbs: '2', taskName: 'B', sharePercent: 40 },
  ]),
  purchase('removed', '2026-04-15', 1_000_000, [{ taskId: null, taskWbs: '9', taskName: 'old', sharePercent: 100 }]),
  purchase('future', '2026-06-01', 7_000_000, [{ taskId: 'A', taskWbs: '1', taskName: 'A', sharePercent: 100 }]),
]
const dated = purchases.map((p) => ({ date: p.purchaseDate, amount: p.amount }))

describe('item costs', () => {
  const items = buildItemCosts({ overheadMonths: months, activities, purchases, todayIso: TODAY })
  const a = items.rows.find((r) => r.id === 'A')!
  const b = items.rows.find((r) => r.id === 'B')!

  it('charges contractor work and consumed purchases by progress', () => {
    expect(a.contractor).toBe(800_000)
    expect(b.contractor).toBe(100_000)
    expect(a.purchaseAllocated).toBe(6_000_000)
    expect(a.purchaseConsumed).toBe(4_800_000)
    expect(b.purchaseConsumed).toBe(800_000)
    expect(items.materialsOnSite).toBe(1_200_000 + 3_200_000 + 1_000_000)
  })

  it('gives a month of overhead to the items that earned weight in it', () => {
    // Only A progressed in Farvardin, so it carries that whole month.
    expect(a.overhead).toBeGreaterThanOrEqual(100_000_000)
    expect(b.overhead).toBeGreaterThan(0)
    expect(items.unallocatedOverhead).toBe(0)
  })

  it('adds up to the live total with unallocated overhead and materials on site', () => {
    const model = buildLiveWorkshopCostModel({ overheadMonths: months, activities, purchases: dated, todayIso: TODAY })
    const itemsTotal = items.rows.reduce((s, r) => s + r.total, 0)
    expect(Math.round(itemsTotal + items.unallocatedOverhead + items.materialsOnSite)).toBe(Math.round(model.total))
  })

  it('leaves overhead unallocated when no item progressed that month', () => {
    const idle = buildItemCosts({
      overheadMonths: months,
      activities: activities.map((x) => ({ ...x, progressHistory: [], currentPercent: 0, physicalPercent: 0 })),
      purchases: [],
      todayIso: TODAY,
    })
    expect(idle.unallocatedOverhead).toBeGreaterThanOrEqual(100_000_000)
  })
})

describe('cost curve', () => {
  const points = buildCostCurve({ overheadMonths: months, activities, purchases: dated, todayIso: TODAY })

  it('ends the actual layers on today with the live total', () => {
    const today = points.find((p) => p.isToday)!
    const model = buildLiveWorkshopCostModel({ overheadMonths: months, activities, purchases: dated, todayIso: TODAY })
    expect(today.total).toBe(model.total)
    expect(today.purchases).toBe(11_000_000)
  })

  it('is cumulative and continues only the planned line after today', () => {
    const past = points.filter((p) => p.total != null)
    for (let i = 1; i < past.length; i += 1) expect(past[i]!.total!).toBeGreaterThanOrEqual(past[i - 1]!.total!)
    const future = points.filter((p) => p.date > TODAY)
    expect(future.length).toBeGreaterThan(0)
    expect(future.every((p) => p.total == null && p.earned == null && p.planned != null)).toBe(true)
    expect(points[points.length - 1]!.date).toBe('2026-06-30')
    expect(points[points.length - 1]!.planned).toBe(1_500_000)
  })

  it('spreads a closed month of overhead over its days', () => {
    const mid = points.find((p) => p.date > '2026-04-01' && p.date < '2026-04-15')!
    expect(mid.overhead!).toBeGreaterThan(0)
    expect(mid.overhead!).toBeLessThan(100_000_000)
  })

  it('reads earned value from the reported progress', () => {
    const today = points.find((p) => p.isToday)!
    // weighted earned = (60×80 + 40×20) / 100 = 56 % of BAC 1,500,000
    expect(today.earned).toBe(840_000)
  })
})
