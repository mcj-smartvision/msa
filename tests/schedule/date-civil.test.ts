import { describe, expect, it } from 'vitest'
import { addDaysIso, formatScheduleDate, toIsoDateOnly } from '@/features/schedule/lib/dates'

describe('toIsoDateOnly civil dates', () => {
  it('keeps pure YYYY-MM-DD unchanged', () => {
    expect(toIsoDateOnly('2026-04-21')).toBe('2026-04-21')
  })

  it('uses local calendar day for timestamptz (not UTC string prefix)', () => {
    // Construct a Date that is definitely local calendar 2026-04-21 noon
    const localNoon = new Date(2026, 3, 21, 12, 0, 0)
    const iso = localNoon.toISOString()
    expect(toIsoDateOnly(iso)).toBe('2026-04-21')
  })

  it('formatScheduleDate follows toIsoDateOnly', () => {
    const localNoon = new Date(2026, 3, 21, 12, 0, 0)
    const jalali = formatScheduleDate(localNoon.toISOString(), 'jalali')
    expect(jalali).toMatch(/^\d{4}\/\d{2}\/\d{2}$/)
    expect(formatScheduleDate('2026-04-21', 'gregorian')).toBe('2026-04-21')
  })

  it('addDaysIso stays on civil calendar', () => {
    expect(addDaysIso('2026-04-21', 10)).toBe('2026-05-01')
  })
})
