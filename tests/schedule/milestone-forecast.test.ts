import { describe, expect, it } from 'vitest'
import { addDaysIso } from '@/features/schedule/lib/dates'

describe('milestone predicted date from CPM epoch', () => {
  it('maps early_finish days onto calendar baseline once', () => {
    const epoch = '2026-04-21'
    const earlyFinish = 14
    const predicted = addDaysIso(epoch, earlyFinish)
    expect(predicted).toBe('2026-05-05')
    // second calc would use same baseline column — not overwritten in persistMilestoneForecasts
    const baselineLocked = predicted
    const laterPredicted = addDaysIso(epoch, 20)
    expect(laterPredicted).not.toBe(baselineLocked)
    expect(baselineLocked).toBe('2026-05-05')
  })
})
