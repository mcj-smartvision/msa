import { describe, expect, it } from 'vitest'
import { tehranDateIso, tehranPeriodStartMs, todayTehranIso, toTehranDateOnly } from '@/shared/lib/time/tehran'

describe('tehran time', () => {
  it('rolls the date over at Tehran midnight, not UTC midnight', () => {
    expect(todayTehranIso(Date.parse('2026-09-30T20:29:00Z'))).toBe('2026-09-30')
    expect(todayTehranIso(Date.parse('2026-09-30T20:30:00Z'))).toBe('2026-10-01')
  })

  it('keeps pure dates and reduces timestamps in Tehran time', () => {
    expect(toTehranDateOnly('2026-10-01')).toBe('2026-10-01')
    expect(toTehranDateOnly('2026-09-30T21:00:00+00:00')).toBe('2026-10-01')
    expect(toTehranDateOnly('')).toBeNull()
    expect(toTehranDateOnly('not a date')).toBeNull()
  })

  it('starts the week on Saturday and the month on the Jalali first', () => {
    // Thursday 2026-10-01 10:00 Tehran = 1405-07-09.
    const now = Date.parse('2026-10-01T06:30:00Z')
    expect(tehranDateIso(tehranPeriodStartMs('today', now))).toBe('2026-10-01')
    expect(tehranDateIso(tehranPeriodStartMs('week', now))).toBe('2026-09-26')
    expect(tehranDateIso(tehranPeriodStartMs('month', now))).toBe('2026-09-23')
    expect(tehranPeriodStartMs('today', now)).toBe(Date.parse('2026-09-30T20:30:00Z'))
  })
})
