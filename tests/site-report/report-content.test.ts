import { describe, expect, it } from 'vitest'
import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { emptyCrewRow } from '@/features/site-report/lib/empty-rows'
import { resolveDailyReportNote, siteReportFallbackNote } from '@/features/site-report/lib/report-content'

describe('siteReportFallbackNote', () => {
  it('includes crew and free notes', () => {
    const report = emptyLipartaDailyReport({ project_name: 'p' })
    report.crews_and_progress = [
      {
        ...emptyCrewRow(),
        activity_name: 'بتن‌ریزی',
        contractor_or_crew: 'اکیپ الف',
        trade: 'بتن',
        headcount: 4,
        regular_hours: 8,
        work_done_today: { quantity: 12, unit: 'م3' },
        requires_completion: false,
      },
    ]
    report.free_notes = 'توضیح اضافه'
    const text = siteReportFallbackNote(report)
    expect(text).toContain('بتن‌ریزی')
    expect(text).toContain('توضیح اضافه')
  })
})

describe('resolveDailyReportNote', () => {
  it('builds archive text from structured form when note is empty', () => {
    const report = emptyLipartaDailyReport({ project_name: 'p' })
    report.work_summary.completed_activities = ['سقف طبقه ۲']
    expect(resolveDailyReportNote('', report)).toContain('سقف طبقه ۲')
  })
})
