import { describe, expect, it } from 'vitest'
import { jalaliSnapshotMonth } from '@/features/schedule/lib/progress-snapshots'

describe('jalaliSnapshotMonth', () => {
  it('labels the month as Jalali day 1 and stores the Gregorian first day', () => {
    // 2026-07-23 is 1405/05/01
    const month = jalaliSnapshotMonth('2026-07-23')
    expect(month).not.toBeNull()
    expect(month?.jalaliMonth).toBe('1405-05-01')
    expect(month?.snapshotMonth).toBe('2026-07-23')
    expect(month?.isLastDay).toBe(false)
  })

  it('flags the last civil day of the Jalali month', () => {
    // 1405/05 has 31 days → 2026-08-22
    const month = jalaliSnapshotMonth('2026-08-22')
    expect(month?.jalaliMonth).toBe('1405-05-01')
    expect(month?.isLastDay).toBe(true)
  })
})
