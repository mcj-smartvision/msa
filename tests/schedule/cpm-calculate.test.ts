import { describe, expect, it } from 'vitest'
import { calculateCpm } from '@/lib/schedule/cpm-calculate'

/**
 * Required network (بخش ۲):
 * A 5d (none) → B 2d FS → C 5d FS
 *                      ↘ D 7d FS
 * Expect: A,B,D critical; C float=2; project=14
 */
describe('calculateCpm — required A/B/C/D network', () => {
  const activities = [
    { id: 'A', durationDays: 5 },
    { id: 'B', durationDays: 2 },
    { id: 'C', durationDays: 5 },
    { id: 'D', durationDays: 7 },
  ]

  const dependencies = [
    { predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'B', successorId: 'C', type: 'FS' as const, lagDays: 0 },
    { predecessorId: 'B', successorId: 'D', type: 'FS' as const, lagDays: 0 },
  ]

  it('marks A, B, D critical; C float 2; project duration 14', () => {
    const result = calculateCpm(activities, dependencies)
    expect(result.success).toBe(true)
    if (result.success === false) return

    expect(result.projectDurationDays).toBe(14)

    const byId = Object.fromEntries(result.activities.map((a) => [a.id, a]))

    expect(byId.A.earlyStart).toBe(0)
    expect(byId.A.earlyFinish).toBe(5)
    expect(byId.A.totalFloat).toBe(0)
    expect(byId.A.isCritical).toBe(true)

    expect(byId.B.earlyStart).toBe(5)
    expect(byId.B.earlyFinish).toBe(7)
    expect(byId.B.totalFloat).toBe(0)
    expect(byId.B.isCritical).toBe(true)

    expect(byId.C.earlyStart).toBe(7)
    expect(byId.C.earlyFinish).toBe(12)
    expect(byId.C.totalFloat).toBe(2)
    expect(byId.C.isCritical).toBe(false)

    expect(byId.D.earlyStart).toBe(7)
    expect(byId.D.earlyFinish).toBe(14)
    expect(byId.D.totalFloat).toBe(0)
    expect(byId.D.isCritical).toBe(true)

    expect(result.criticalIds.sort()).toEqual(['A', 'B', 'D'])
  })

  it('stops with CYCLE_DETECTED on circular dependencies', () => {
    const result = calculateCpm(
      [
        { id: 'X', durationDays: 1 },
        { id: 'Y', durationDays: 1 },
      ],
      [
        { predecessorId: 'X', successorId: 'Y', type: 'FS', lagDays: 0 },
        { predecessorId: 'Y', successorId: 'X', type: 'FS', lagDays: 0 },
      ]
    )
    expect(result.success).toBe(false)
    if (result.success === true) return
    expect(result.error).toBe('CYCLE_DETECTED')
    expect(result.cycleIds?.length).toBeGreaterThan(0)
  })
})
