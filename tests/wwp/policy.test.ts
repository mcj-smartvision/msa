import { describe, expect, it } from 'vitest'
import { checkWwpAction, projectWeekNumber, validateOutcome, weekBounds } from '@/features/wwp/lib/policy'

const week = { startDate: '2026-10-03', endDate: '2026-10-09' }

describe('WWP role matrix', () => {
  it('drafts and commitments: planner and site supervisor only', () => {
    for (const role of ['planning_engineer', 'site_supervisor']) {
      expect(checkWwpAction({ action: 'edit_draft', positionKeys: [role], status: 'DRAFT', ...week, today: '2026-10-01' }).ok).toBe(true)
    }
    const pm = checkWwpAction({ action: 'edit_draft', positionKeys: ['project_manager'], status: 'DRAFT', ...week, today: '2026-10-01' })
    expect(pm).toMatchObject({ ok: false, code: 'FORBIDDEN' })
  })

  it('freeze: PM or planner, on or before Saturday, with at least one commitment', () => {
    const base = { action: 'freeze' as const, status: 'DRAFT' as const, ...week, commitmentCount: 3 }
    expect(checkWwpAction({ ...base, positionKeys: ['project_manager'], today: '2026-10-03' }).ok).toBe(true)
    expect(checkWwpAction({ ...base, positionKeys: ['planning_engineer'], today: '2026-10-02' }).ok).toBe(true)
    expect(checkWwpAction({ ...base, positionKeys: ['site_supervisor'], today: '2026-10-02' })).toMatchObject({ ok: false, code: 'FORBIDDEN' })
    expect(checkWwpAction({ ...base, positionKeys: ['project_manager'], today: '2026-10-04' })).toMatchObject({ ok: false, code: 'VALIDATION' })
    expect(checkWwpAction({ ...base, positionKeys: ['project_manager'], today: '2026-10-02', commitmentCount: 0 }).ok).toBe(false)
  })

  it('outcomes and close: PM only; close from Friday with no open outcome', () => {
    const base = { status: 'FROZEN' as const, ...week }
    expect(checkWwpAction({ ...base, action: 'record_outcome', positionKeys: ['project_manager'], today: '2026-10-05' }).ok).toBe(true)
    expect(checkWwpAction({ ...base, action: 'record_outcome', positionKeys: ['planning_engineer'], today: '2026-10-05' }).ok).toBe(false)
    expect(checkWwpAction({ ...base, action: 'close', positionKeys: ['planning_engineer'], today: '2026-10-09', openOutcomeCount: 0 })).toMatchObject({ code: 'FORBIDDEN' })
    expect(checkWwpAction({ ...base, action: 'close', positionKeys: ['project_manager'], today: '2026-10-08', openOutcomeCount: 0 }).ok).toBe(false)
    expect(checkWwpAction({ ...base, action: 'close', positionKeys: ['project_manager'], today: '2026-10-09', openOutcomeCount: 2 }).ok).toBe(false)
    expect(checkWwpAction({ ...base, action: 'close', positionKeys: ['project_manager'], today: '2026-10-09', openOutcomeCount: 0 }).ok).toBe(true)
  })

  it('nothing changes after close or in the wrong state', () => {
    expect(checkWwpAction({ action: 'record_outcome', positionKeys: ['project_manager'], status: 'CLOSED', ...week, today: '2026-10-10' }).ok).toBe(false)
    expect(checkWwpAction({ action: 'edit_draft', positionKeys: ['site_supervisor'], status: 'FROZEN', ...week, today: '2026-10-02' }).ok).toBe(false)
    expect(checkWwpAction({ action: 'record_outcome', positionKeys: ['project_manager'], status: 'DRAFT', ...week, today: '2026-10-02' }).ok).toBe(false)
  })
})

describe('WWP week and outcome rules', () => {
  it('weeks run Saturday to Friday', () => {
    expect(weekBounds('2026-10-03')).toEqual({ start: '2026-10-03', end: '2026-10-09' })
    expect(weekBounds('2026-10-04')).toBeNull()
  })

  it('numbers weeks from the Saturday on or before the project start', () => {
    expect(projectWeekNumber('2026-01-04', '2026-01-03')).toBe(1)
    expect(projectWeekNumber('2026-01-04', '2026-01-10')).toBe(2)
    expect(projectWeekNumber('2026-01-03', '2026-01-03')).toBe(1)
  })

  it('a missed commitment needs a listed root cause; "other" needs a note; a hit has none', () => {
    expect(validateOutcome({ isCompleted: true }).ok).toBe(true)
    expect(validateOutcome({ isCompleted: true, rootCauseCategory: 'crew' }).ok).toBe(false)
    expect(validateOutcome({ isCompleted: false }).ok).toBe(false)
    expect(validateOutcome({ isCompleted: false, rootCauseCategory: 'unknown' }).ok).toBe(false)
    expect(validateOutcome({ isCompleted: false, rootCauseCategory: 'other' }).ok).toBe(false)
    expect(validateOutcome({ isCompleted: false, rootCauseCategory: 'other', rootCauseNote: 'سیل' }).ok).toBe(true)
    expect(validateOutcome({ isCompleted: false, rootCauseCategory: 'materials', actualOutput: -1 }).ok).toBe(false)
  })
})
