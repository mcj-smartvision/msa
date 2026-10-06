import { describe, expect, it } from 'vitest'
import { checkProjectWeightTotal, resolveSiblingWeights } from '@/features/schedule/lib/weight-consistency'
import { resolvePackageWeights } from '@/features/evm/lib/load-project-evm'

describe('resolveSiblingWeights (absolute package weights)', () => {
  it('keeps absolute weights that sum to the parent (Noor: 6 + 11 = 17)', () => {
    const { weights, issue } = resolveSiblingWeights(17, [6, 11])
    expect(weights).toEqual([6, 11])
    expect(issue).toBeNull()
  })

  it('splits the remaining parent weight equally among unweighted siblings', () => {
    const { weights, issue } = resolveSiblingWeights(17, [6, null, 0])
    expect(weights).toEqual([6, 5.5, 5.5])
    expect(issue).toBeNull()
  })

  it('scales a mismatched group to the parent weight and reports it without throwing', () => {
    const { weights, issue } = resolveSiblingWeights(17, [6, 6])
    expect(weights[0]! + weights[1]!).toBeCloseTo(17, 10)
    expect(weights[0]).toBeCloseTo(8.5, 10)
    expect(issue).toMatchObject({ code: 'children_sum_mismatch', expected: 17, actual: 12 })
  })

  it('reports weighted siblings that leave nothing for unweighted ones', () => {
    const { weights, issue } = resolveSiblingWeights(10, [8, 4, null])
    expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(10, 10)
    expect(weights[2]).toBe(0)
    expect(issue?.code).toBe('children_exceed_parent')
  })

  it('uses entered weights when the parent has no weight', () => {
    expect(resolveSiblingWeights(0, [3, null]).weights).toEqual([3, 1])
  })
})

describe('checkProjectWeightTotal', () => {
  it('accepts 100 and flags anything else', () => {
    expect(checkProjectWeightTotal([60, 23, 17])).toBeNull()
    expect(checkProjectWeightTotal([60, 23, 2.89])).toMatchObject({ code: 'project_total_mismatch', actual: 85.89 })
  })
})

describe('resolvePackageWeights (EVM loader)', () => {
  const tasks = new Map<string, Record<string, unknown>>([
    ['t1', { id: 't1', name: 'سفت‌کاری', schedule_weight: 17 }],
  ])

  it('gives Noor packages their absolute weights, not parent × percent', () => {
    const { weights, issues } = resolvePackageWeights(
      [
        { id: 'p35', project_task_id: 't1', weight_percent: 11 },
        { id: 'p10', project_task_id: 't1', weight_percent: 6 },
      ],
      tasks
    )
    expect(weights.get('p35')).toBe(11)
    expect(weights.get('p10')).toBe(6)
    expect(issues).toEqual([])
  })

  it('resolves nested packages against their parent package weight', () => {
    const { weights } = resolvePackageWeights(
      [
        { id: 'a', project_task_id: 't1', weight_percent: 11 },
        { id: 'b', project_task_id: 't1', weight_percent: 6 },
        { id: 'a1', project_task_id: 't1', parent_package_id: 'a', weight_percent: 4 },
        { id: 'a2', project_task_id: 't1', parent_package_id: 'a', weight_percent: null },
      ],
      tasks
    )
    expect(weights.get('a1')).toBe(4)
    expect(weights.get('a2')).toBe(7)
  })

  it('logs (returns) a mismatch but still produces weights', () => {
    const { weights, issues } = resolvePackageWeights(
      [
        { id: 'x', project_task_id: 't1', weight_percent: 50 },
        { id: 'y', project_task_id: 't1', weight_percent: 50 },
      ],
      tasks
    )
    expect(weights.get('x')).toBeCloseTo(8.5, 10)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: 'children_sum_mismatch', parentLabel: 'سفت‌کاری' })
  })
})
