import { describe, expect, it } from 'vitest'
import { resolveActivityBudgets } from '@/features/evm/lib/metrics'

describe('activity budgets — technical office cost first', () => {
  it('uses the «هزینه» column when any activity has a cost (Noor leaf costs → BAC 3,000)', () => {
    // Noor leaf rows (summary rows 350/250/700 are rollups and not items); the two wall packages
    // split task 6's cost of 360 by their weights 11 : 6.
    const costs = [550, 400, 95, 100, 50, 100, 100, 100, 150, (360 * 11) / 17, (360 * 6) / 17, 200, 100, 200, 400, 95, 0]
    const items = costs.map((mspCost, i) => ({ mspCost, contractValue: 100 + i, weight: 1 }))
    const { basis, budgets } = resolveActivityBudgets(items, 5000)
    expect(basis).toBe('technical_office_cost')
    expect(budgets).toEqual(costs)
    expect(budgets.reduce((s, b) => s + b, 0)).toBeCloseTo(3000, 9)
  })

  it('falls back to quantity × unit price, then to the project budget by weight', () => {
    expect(resolveActivityBudgets([{ mspCost: 0, contractValue: 40, weight: 1 }], 1000)).toEqual({ basis: 'contract_value', budgets: [40] })
    expect(
      resolveActivityBudgets(
        [
          { mspCost: 0, contractValue: 0, weight: 3 },
          { mspCost: 0, contractValue: 0, weight: 1 },
        ],
        1000
      )
    ).toEqual({ basis: 'weighted_project_budget', budgets: [750, 250] })
  })
})
