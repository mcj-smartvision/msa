import { describe, expect, it } from 'vitest'
import { extractAiHighlightNote, progressDeltaLabel } from '@/features/supervisor/lib/daily-report-history'
import { WEATHER_NOTE_PREFIX } from '@/features/weather/lib/report-stamp'

describe('progressDeltaLabel', () => {
  it('signs the change since the previous report with English digits', () => {
    expect(progressDeltaLabel(20, 32.5)).toBe('+12.5٪ نسبت به گزارش قبلی')
    expect(progressDeltaLabel(40, 35)).toBe('-5٪ نسبت به گزارش قبلی')
    expect(progressDeltaLabel(40, 40)).toBe('0٪ نسبت به گزارش قبلی')
  })
})

describe('extractAiHighlightNote', () => {
  it('does not treat the auto weather line as the field note', () => {
    const note = `${WEATHER_NOTE_PREFIX} تهران · آسمان صاف · 25°\nکمبود میلگرد`
    expect(extractAiHighlightNote(note)).toBe('کمبود میلگرد')
  })
})
