import { describe, expect, it } from 'vitest'
import { linesToText, normalizeLines, optionalText, textToLines } from '@/features/site-report/lib/lines'

describe('textToLines / linesToText', () => {
  it('preserves spaces while typing', () => {
    expect(textToLines('سلام ')).toEqual(['سلام '])
    expect(linesToText(['سلام '])).toBe('سلام ')
  })

  it('preserves empty trailing lines', () => {
    expect(textToLines('یک\n')).toEqual(['یک', ''])
    expect(linesToText(['یک', ''])).toBe('یک\n')
  })
})

describe('normalizeLines', () => {
  it('trims blank lines for archive', () => {
    expect(normalizeLines(['  a  ', '', '  '])).toEqual(['a'])
  })
})

describe('optionalText', () => {
  it('keeps spaces', () => {
    expect(optionalText(' ')).toBe(' ')
    expect(optionalText('')).toBeNull()
  })
})
