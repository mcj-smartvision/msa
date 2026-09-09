import { describe, expect, it } from 'vitest'
import { applyParentWeightSum } from '@/lib/schedule/parent-weight-rollup'

describe('applyParentWeightSum', () => {
  it('sets parent weight to sum of direct children', () => {
    const { weights, parentIds, explanations } = applyParentWeightSum([
      { id: 'p4', wbs: '4', name: 'فونداسیون', weight: 20 },
      { id: 'c41', wbs: '4.1', name: 'آرماتوربندی', weight: 7 },
      { id: 'c42', wbs: '4.2', name: 'قالب‌بندی', weight: 5 },
      { id: 'c43', wbs: '4.3', name: 'روغن کاری', weight: 3 },
      { id: 'c44', wbs: '4.4', name: 'بتن‌ریزی', weight: 8 },
    ])

    expect(weights.p4).toBe(23)
    expect(weights.c41).toBe(7)
    expect(parentIds.has('p4')).toBe(true)
    expect(explanations.get('p4')?.text).toContain('7')
    expect(explanations.get('p4')?.text).toMatch(/=\s*23\s*$|=\s*23/)
    expect(explanations.get('p4')?.sum).toBe(23)
  })

  it('rolls nested parents bottom-up', () => {
    const { weights } = applyParentWeightSum([
      { id: 'a', wbs: '1', name: 'A', weight: 99 },
      { id: 'b', wbs: '1.1', name: 'B', weight: 99 },
      { id: 'c', wbs: '1.1.1', name: 'C', weight: 4 },
      { id: 'd', wbs: '1.1.2', name: 'D', weight: 6 },
      { id: 'e', wbs: '1.2', name: 'E', weight: 10 },
    ])
    expect(weights.b).toBe(10) // 4+6
    expect(weights.a).toBe(20) // B(10)+E(10)
  })
})
