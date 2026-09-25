import { describe, expect, it } from 'vitest'
import {
  computeAlertQuadrant,
  isCriticalOrNearCritical,
} from '@/lib/schedule/progress-alert-quadrant'

describe('progress alert quadrant', () => {
  const near = 5

  it('detects critical / near-critical zone', () => {
    expect(isCriticalOrNearCritical(true, 20, near)).toBe(true)
    expect(isCriticalOrNearCritical(false, 3, near)).toBe(true)
    expect(isCriticalOrNearCritical(false, 0, near)).toBe(true)
    expect(isCriticalOrNearCritical(false, 10, near)).toBe(false)
  })

  it('returns null when not in-progress (no pace)', () => {
    expect(
      computeAlertQuadrant({
        paceStatus: null,
        isCritical: true,
        totalFloatDays: 0,
        nearCriticalDays: near,
      })
    ).toBeNull()
  })

  it('2×2 matrix', () => {
    expect(
      computeAlertQuadrant({
        paceStatus: 'bad',
        isCritical: true,
        totalFloatDays: 0,
        nearCriticalDays: near,
      })
    ).toBe('urgent')
    expect(
      computeAlertQuadrant({
        paceStatus: 'warning',
        isCritical: false,
        totalFloatDays: 2,
        nearCriticalDays: near,
      })
    ).toBe('urgent')
    expect(
      computeAlertQuadrant({
        paceStatus: 'good',
        isCritical: true,
        totalFloatDays: 0,
        nearCriticalDays: near,
      })
    ).toBe('normal_watch')
    expect(
      computeAlertQuadrant({
        paceStatus: 'bad',
        isCritical: false,
        totalFloatDays: 20,
        nearCriticalDays: near,
      })
    ).toBe('soft_notice')
    expect(
      computeAlertQuadrant({
        paceStatus: 'good',
        isCritical: false,
        totalFloatDays: 20,
        nearCriticalDays: near,
      })
    ).toBe('no_display')
  })
})
