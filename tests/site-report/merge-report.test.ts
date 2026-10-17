import { describe, expect, it } from 'vitest'
import { emptyLipartaDailyReport } from '@/features/site-report/lib/empty-report'
import { mergeLipartaDailyReport } from '@/features/site-report/lib/merge-report'
import { checkSiteReportReadyToSend } from '@/features/site-report/lib/validate-report'
import { sectionsForPrint } from '@/features/site-report/lib/section-visibility'

describe('mergeLipartaDailyReport', () => {
  it('does not overwrite filled fields with null from a second voice patch', () => {
    const base = emptyLipartaDailyReport({ project_name: 'vegas' })
    base.weather.morning_condition = 'صاف'
    base.weather.lost_hours = 2
    base.crews_and_progress = [
      {
        contractor_or_crew: 'اکیپ بتن',
        trade: 'بتن‌ریزی',
        activity_name: 'سقف',
        location: {},
        headcount: 8,
        regular_hours: 8,
        work_done_today: { quantity: 20, unit: 'م3' },
        activity_status: 'در حال انجام',
        requires_completion: false,
      },
    ]

    const merged = mergeLipartaDailyReport(base, {
      weather: {
        morning_condition: null,
        noon_condition: 'ابری',
        impact_level: 'کاهش بازده',
        lost_hours: null,
      },
      crews_and_progress: [
        {
          contractor_or_crew: 'اکیپ بتن',
          trade: 'بتن‌ریزی',
          activity_name: 'سقف',
          location: { zone: 'A' },
          headcount: null,
          regular_hours: null,
          work_done_today: { quantity: null, unit: null },
          activity_status: 'در حال انجام',
          requires_completion: true,
        },
      ],
    })

    expect(merged.weather.morning_condition).toBe('صاف')
    expect(merged.weather.noon_condition).toBe('ابری')
    expect(merged.weather.lost_hours).toBe(2)
    expect(merged.crews_and_progress[0]?.headcount).toBe(8)
    expect(merged.crews_and_progress[0]?.location.zone).toBe('A')
  })

  it('blocks send when mandatory sections empty', () => {
    const report = emptyLipartaDailyReport()
    const check = checkSiteReportReadyToSend(report)
    expect(check.ok).toBe(false)
    expect(check.missingMandatory).toContain('weather')
    expect(check.missingMandatory).toContain('crews_and_progress')
    expect(check.missingMandatory).toContain('tomorrow_plan')
  })

  it('hides empty event sections from print list', () => {
    const report = emptyLipartaDailyReport({ project_name: 'p' })
    report.weather.morning_condition = 'بارانی'
    report.weather.impact_level = 'کاهش بازده'
    report.crews_and_progress.push({
      contractor_or_crew: 'c',
      trade: 't',
      activity_name: 'a',
      location: {},
      headcount: 1,
      regular_hours: 8,
      work_done_today: { quantity: 1, unit: 'عدد' },
      activity_status: 'تمام شد',
      requires_completion: false,
    })
    report.tomorrow_plan.planned_activities = ['فردا سقف']
    const ids = sectionsForPrint(report)
    expect(ids).toContain('weather')
    expect(ids).not.toContain('quality_control')
    expect(ids).not.toContain('hse')
  })
})
