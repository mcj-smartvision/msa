import { describe, expect, it } from 'vitest'
import { explainDependencyLink } from '@/features/schedule/lib/dependency-explain'

describe('explainDependencyLink', () => {
  it('names both activities clearly as from → next', () => {
    const { shortLabel, tooltip } = explainDependencyLink({
      type: 'FS',
      lagDays: 2,
      predecessor: { wbs: '1.4', name: 'خاکبرداری' },
      successor: { wbs: '1.5', name: 'اجرای فونداسیون' },
    })
    expect(shortLabel).toBe('FS+2d')
    expect(tooltip).toContain('از این فعالیت')
    expect(tooltip).toContain('1.4 — خاکبرداری')
    expect(tooltip).toContain('به فعالیت بعدی')
    expect(tooltip).toContain('1.5 — اجرای فونداسیون')
    expect(tooltip).toContain('تا «خاکبرداری» تمام نشود')
    expect(tooltip).toContain('اجرای فونداسیون')
    expect(tooltip).toContain('2 روز تأخیر')
  })
})
