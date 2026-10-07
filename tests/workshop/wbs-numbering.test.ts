import { describe, expect, it } from 'vitest'
import { nextFreeChildWbs } from '@/features/workshop/lib/wbs-numbering'

describe('nextFreeChildWbs', () => {
  it('numbers a package after the sub-tasks and packages already under its parent', () => {
    expect(nextFreeChildWbs('4', ['4', '4.1', '4.2', '4.3', '4.4', '5.1'])).toBe('4.5')
    expect(nextFreeChildWbs('4', ['4.1', '4.4', '4.5', '4.1.2'])).toBe('4.6')
    expect(nextFreeChildWbs('7', ['7.1', '7.2', '7.3', '7.3'])).toBe('7.4')
  })

  it('starts at 1 under an empty parent and handles a root parent', () => {
    expect(nextFreeChildWbs('9', [null, '10.1'])).toBe('9.1')
    expect(nextFreeChildWbs(null, ['1', '2', '2.1'])).toBe('3')
  })
})
