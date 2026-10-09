import { describe, expect, it } from 'vitest'
import { isEndBeforeStart, withDefaultEnd } from '@/features/holidays/lib/holiday-form'
import type { HolidayInput } from '@/features/holidays/lib/types'

const form = (patch: Partial<HolidayInput>): HolidayInput => ({
  type: 'official',
  startDate: '',
  endDate: null,
  title: 'نوروز',
  description: null,
  isActive: true,
  ...patch,
})

describe('isEndBeforeStart', () => {
  it('flags an end earlier than the start only', () => {
    expect(isEndBeforeStart(form({ startDate: '2026-03-21', endDate: '2026-03-20' }))).toBe(true)
    expect(isEndBeforeStart(form({ startDate: '2026-03-21', endDate: '2026-03-21' }))).toBe(false)
    expect(isEndBeforeStart(form({ startDate: '2026-03-21', endDate: '2026-03-24' }))).toBe(false)
    expect(isEndBeforeStart(form({ startDate: '2026-03-21', endDate: null }))).toBe(false)
    expect(isEndBeforeStart(form({ startDate: '', endDate: '2026-03-20' }))).toBe(false)
  })
})

describe('withDefaultEnd', () => {
  it('defaults an empty or earlier end to the start for dated holidays', () => {
    expect(withDefaultEnd(form({ startDate: '2026-03-21' })).endDate).toBe('2026-03-21')
    expect(withDefaultEnd(form({ type: 'organizational', startDate: '2026-03-21', endDate: '2026-03-01' })).endDate).toBe('2026-03-21')
  })

  it('keeps a later end so multi-day holidays stay multi-day', () => {
    expect(withDefaultEnd(form({ startDate: '2026-03-21', endDate: '2026-03-24' })).endDate).toBe('2026-03-24')
  })

  it('leaves weekly rules open-ended and forms without a start untouched', () => {
    expect(withDefaultEnd(form({ type: 'weekly', startDate: '2026-03-21' })).endDate).toBeNull()
    expect(withDefaultEnd(form({ startDate: '' })).endDate).toBeNull()
  })
})
