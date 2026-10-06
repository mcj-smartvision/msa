import { describe, expect, it } from 'vitest'
import { applyWeightedParentRollup, formatProgressRollupFormula } from '@/features/schedule/lib/parent-progress-rollup'

describe('applyWeightedParentRollup', () => {
  it('computes foundation parent from weighted children (user example)', () => {
    const { percents, parentIds, explanations } = applyWeightedParentRollup([
      {
        id: 'p4',
        wbs: '4',
        name: 'فونداسیون',
        weight: 20,
        percent: 0,
      },
      {
        id: 'c41',
        wbs: '4.1',
        name: 'آرماتوربندی فونداسیون',
        weight: 7,
        percent: 80,
      },
      {
        id: 'c42',
        wbs: '4.2',
        name: 'قالب‌بندی فونداسیون',
        weight: 5,
        percent: 50,
      },
      {
        id: 'c43',
        wbs: '4.3',
        name: 'روغن کاری قالب فونداسیون',
        weight: null,
        percent: 30,
      },
      {
        id: 'c44',
        wbs: '4.4',
        name: 'بتن‌ریزی فونداسیون',
        weight: 8,
        percent: 0,
      },
    ])

    // (7*80 + 5*50 + 8*0) / (7+5+8) = 810/20 = 40.5 → 41
    expect(percents.p4).toBe(41)
    expect(percents.c41).toBe(80)
    expect(parentIds.has('p4')).toBe(true)
    expect(explanations.get('p4')?.text).toBe(
      '(80×7 + 50×5 + 0×8) / (7 + 5 + 8) = 41%'
    )
    expect(formatProgressRollupFormula(explanations.get('p4')!)).toBe(
      '(80×7 + 50×5 + 0×8) / (7 + 5 + 8) = 41%'
    )
  })

  it('rolls nested parents bottom-up', () => {
    const { percents } = applyWeightedParentRollup([
      { id: 'a', wbs: '1', name: 'A', weight: 10, percent: 0 },
      { id: 'b', wbs: '1.1', name: 'B', weight: 10, percent: 0 },
      { id: 'c', wbs: '1.1.1', name: 'C', weight: 4, percent: 100 },
      { id: 'd', wbs: '1.1.2', name: 'D', weight: 6, percent: 50 },
    ])
    // B = (4*100 + 6*50)/10 = 70
    expect(percents.b).toBe(70)
    // A from only direct child B weight 10 → 70
    expect(percents.a).toBe(70)
  })
})
