import { describe, expect, it } from 'vitest'
import { progressDeltaLabel } from '@/features/supervisor/lib/daily-report-history'

describe('progressDeltaLabel', () => {
  it('signs the change since the previous report with English digits', () => {
    expect(progressDeltaLabel(20, 32.5)).toBe('+12.5٪ نسبت به گزارش قبلی')
    expect(progressDeltaLabel(40, 35)).toBe('-5٪ نسبت به گزارش قبلی')
    expect(progressDeltaLabel(40, 40)).toBe('0٪ نسبت به گزارش قبلی')
  })
})
