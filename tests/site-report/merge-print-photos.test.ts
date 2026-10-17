import { describe, expect, it } from 'vitest'
import { mergePrintPhotos } from '@/features/site-report/lib/merge-print-photos'

describe('mergePrintPhotos', () => {
  it('prefers live uploaded photos', () => {
    const live = [{ url: 'https://a/1.jpg', caption: 'live' }]
    const report = [{ url: 'https://b/2.jpg', caption: 'old' }]
    expect(mergePrintPhotos(live, report)).toEqual(live)
  })

  it('falls back to report attachments', () => {
    expect(mergePrintPhotos([], [{ url: 'https://b/2.jpg', caption: 'old' }])).toEqual([
      { url: 'https://b/2.jpg', caption: 'old' },
    ])
  })
})
