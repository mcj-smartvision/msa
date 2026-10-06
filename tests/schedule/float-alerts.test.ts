import { describe, expect, it } from 'vitest'
import {
buildScheduleAlertDrafts,
computeFloatConsumptionRate,
DEFAULT_PROJECT_ALERT_SETTINGS,
} from '@/features/schedule/lib/float-alerts'

describe('computeFloatConsumptionRate', () => {
  it('uses (prev - current) / daysBetween and weekly = rate * 7', () => {
    const result = computeFloatConsumptionRate(10, 6, '2026-09-01', '2026-09-08')
    expect(result).not.toBeNull()
    expect(result!.daysBetween).toBe(7)
    expect(result!.ratePerDay).toBeCloseTo(4 / 7)
    expect(result!.weeklyRate).toBeCloseTo(4)
  })

  it('returns null when dates are not advancing', () => {
    expect(computeFloatConsumptionRate(5, 3, '2026-09-07', '2026-09-07')).toBeNull()
  })
})

describe('buildScheduleAlertDrafts', () => {
  it('emits negative / critical / near_critical by float rules', () => {
    const drafts = buildScheduleAlertDrafts({
      activities: [
        { id: 'n', name: 'Neg', totalFloat: -1 },
        { id: 'c', name: 'Crit', totalFloat: 0 },
        { id: 'nc', name: 'Near', totalFloat: 3 },
        { id: 'ok', name: 'Ok', totalFloat: 10 },
      ],
      previousByActivityId: new Map(),
      currentDate: '2026-09-07',
      settings: DEFAULT_PROJECT_ALERT_SETTINGS,
      existingUnackedKeys: new Set(),
    })

    const byId = Object.fromEntries(drafts.map((d) => [d.activityId, d.severity]))
    expect(byId.n).toBe('negative')
    expect(byId.c).toBe('critical')
    expect(byId.nc).toBe('near_critical')
    expect(byId.ok).toBeUndefined()
  })

  it('emits fast_consumption when weekly rate exceeds threshold', () => {
    // Lose 4 float days in 7 calendar days → weekly 4 > threshold 3
    const drafts = buildScheduleAlertDrafts({
      activities: [{ id: 'f', name: 'Fast', totalFloat: 2 }],
      previousByActivityId: new Map([
        ['f', { totalFloat: 6, calculationDate: '2026-09-01' }],
      ]),
      currentDate: '2026-09-08',
      settings: {
        nearCriticalDays: 5,
        fastConsumptionThreshold: 3,
        paceGoodThreshold: 0.9,
        paceWarningThreshold: 0.6,
      },
      existingUnackedKeys: new Set(),
    })

    expect(drafts.some((d) => d.severity === 'fast_consumption')).toBe(true)
    expect(drafts.some((d) => d.severity === 'near_critical')).toBe(true)
  })

  it('skips duplicate unacked severity for same activity today', () => {
    const drafts = buildScheduleAlertDrafts({
      activities: [{ id: 'c', name: 'Crit', totalFloat: 0 }],
      previousByActivityId: new Map(),
      currentDate: '2026-09-07',
      existingUnackedKeys: new Set(['c:critical']),
    })
    expect(drafts).toHaveLength(0)
  })
})
