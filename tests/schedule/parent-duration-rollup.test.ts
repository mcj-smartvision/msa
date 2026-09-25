import { describe, expect, it } from 'vitest'
import { applyParentDurationSum } from '@/lib/schedule/parent-duration-rollup'

describe('applyParentDurationSum', () => {
  it('sums direct children onto parent summary', () => {
    const result = applyParentDurationSum([
      { id: 'p', wbs: '4', durationDays: 0, isSummary: true },
      { id: 'a', wbs: '4.1', durationDays: 6 },
      { id: 'b', wbs: '4.2', durationDays: 3 },
      { id: 'c', wbs: '4.3', durationDays: 1 },
      { id: 'd', wbs: '4.4', durationDays: 2 },
    ])
    expect(result.durations.p).toBe(12)
    expect(result.durations.a).toBe(6)
    expect(result.parentIds.has('p')).toBe(true)
  })

  it('rolls nested summaries bottom-up', () => {
    const result = applyParentDurationSum([
      { id: 'root', wbs: '1', durationDays: 0, isSummary: true },
      { id: 'mid', wbs: '1.1', durationDays: 0, isSummary: true },
      { id: 'leaf', wbs: '1.1.1', durationDays: 5 },
      { id: 'leaf2', wbs: '1.1.2', durationDays: 3 },
    ])
    expect(result.durations.mid).toBe(8)
    expect(result.durations.root).toBe(8)
  })
})
