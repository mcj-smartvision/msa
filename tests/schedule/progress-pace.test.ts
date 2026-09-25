import { describe, expect, it } from 'vitest'
import { classifyPaceRatio, computeProgressPace, resolvePaceActualStart } from '@/lib/schedule/progress-pace'

describe('computeProgressPace', () => {
  it('returns null when not started', () => {
    const r = computeProgressPace({
      actualStart: null,
      physicalPercentComplete: 20,
      durationDays: 10,
      statusDate: '2026-01-10',
    })
    expect(r.paceStatus).toBeNull()
    expect(r.paceRatio).toBeNull()
  })

  it('returns null when complete', () => {
    const r = computeProgressPace({
      actualStart: '2026-01-01',
      physicalPercentComplete: 100,
      durationDays: 10,
      statusDate: '2026-01-10',
    })
    expect(r.paceStatus).toBeNull()
  })

  it('returns null for summary / milestone', () => {
    expect(
      computeProgressPace({
        actualStart: '2026-01-01',
        physicalPercentComplete: 20,
        durationDays: 10,
        statusDate: '2026-01-05',
        isSummary: true,
      }).paceStatus
    ).toBeNull()
    expect(
      computeProgressPace({
        actualStart: '2026-01-01',
        physicalPercentComplete: 20,
        durationDays: 10,
        statusDate: '2026-01-05',
        isMilestone: true,
      }).paceStatus
    ).toBeNull()
  })

  it('classifies good / warning / bad from pace_ratio', () => {
    // elapsed 5d / duration 10d → expected 50%; physical 50% → ratio 1.0 → good
    expect(
      computeProgressPace({
        actualStart: '2026-01-01',
        physicalPercentComplete: 50,
        durationDays: 10,
        statusDate: '2026-01-06',
      })
    ).toMatchObject({ expectedPercent: 50, paceRatio: 1, paceStatus: 'good' })

    // physical 40 / expected 50 → 0.8 → warning
    expect(
      computeProgressPace({
        actualStart: '2026-01-01',
        physicalPercentComplete: 40,
        durationDays: 10,
        statusDate: '2026-01-06',
      }).paceStatus
    ).toBe('warning')

    // physical 20 / expected 50 → 0.4 → bad
    expect(
      computeProgressPace({
        actualStart: '2026-01-01',
        physicalPercentComplete: 20,
        durationDays: 10,
        statusDate: '2026-01-06',
      }).paceStatus
    ).toBe('bad')
  })

  it('returns null ratio when elapsed days is 0', () => {
    const r = computeProgressPace({
      actualStart: '2026-01-10',
      physicalPercentComplete: 5,
      durationDays: 10,
      statusDate: '2026-01-10',
    })
    expect(r.elapsedDays).toBe(0)
    expect(r.expectedPercent).toBe(0)
    expect(r.paceRatio).toBeNull()
    expect(r.paceStatus).toBeNull()
  })

  it('classifyPaceRatio thresholds (defaults)', () => {
    expect(classifyPaceRatio(0.9)).toBe('good')
    expect(classifyPaceRatio(0.89)).toBe('warning')
    expect(classifyPaceRatio(0.6)).toBe('warning')
    expect(classifyPaceRatio(0.59)).toBe('bad')
  })

  it('classifyPaceRatio respects custom thresholds', () => {
    const t = { goodMin: 0.95, warningMin: 0.75 }
    expect(classifyPaceRatio(0.94, t)).toBe('warning')
    expect(classifyPaceRatio(0.95, t)).toBe('good')
    expect(classifyPaceRatio(0.74, t)).toBe('bad')
  })

  it('uses schedule start when actual_start missing but percent edited', () => {
    const start = resolvePaceActualStart({
      actualStart: null,
      physicalPercentComplete: 40,
      startCurrent: '2026-01-01',
      startPlanned: '2025-12-01',
    })
    expect(start).toBe('2026-01-01')

    const paced = computeProgressPace({
      actualStart: start,
      physicalPercentComplete: 40,
      durationDays: 10,
      statusDate: '2026-01-06',
    })
    expect(paced.paceStatus).toBe('warning')
  })

  it('resolvePaceActualStart ignores zero/complete percent without actual', () => {
    expect(
      resolvePaceActualStart({
        actualStart: null,
        physicalPercentComplete: 0,
        startCurrent: '2026-01-01',
      })
    ).toBeNull()
    expect(
      resolvePaceActualStart({
        actualStart: null,
        physicalPercentComplete: 100,
        startCurrent: '2026-01-01',
      })
    ).toBeNull()
  })
})
