import { describe, expect, it } from 'vitest'
import { normalizeReportDate } from '@/features/supervisor/lib/normalize-report-date'

describe('normalizeReportDate', () => {
  it('keeps plain ISO dates', () => {
    expect(normalizeReportDate('2026-10-17')).toBe('2026-10-17')
  })

  it('strips timestamptz prefixes', () => {
    expect(normalizeReportDate('2026-10-17T00:00:00+00:00')).toBe('2026-10-17')
    expect(normalizeReportDate('2026-10-17 21:00:00')).toBe('2026-10-17')
  })

  it('rejects empty values', () => {
    expect(normalizeReportDate(null)).toBeNull()
    expect(normalizeReportDate('')).toBeNull()
    expect(normalizeReportDate('not-a-date')).toBeNull()
  })
})
