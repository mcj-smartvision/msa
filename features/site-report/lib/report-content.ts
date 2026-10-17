/**
 * @file features/site-report/lib/report-content.ts
 * @purpose تشخیص پر بودن گزارش ساختاریافته و ساخت متن پشتیبان
 * @safe-to-edit YES
 * @affects ثبت / ارسال گزارش روزانه
 * @depends-on features/site-report/lib/types, features/site-report/lib/section-visibility
 */

import { isSiteReportSectionEmpty } from '@/features/site-report/lib/section-visibility'
import type { LipartaDailyReportData, SiteReportSectionId } from '@/features/site-report/lib/types'

const CONTENT_SECTIONS: SiteReportSectionId[] = [
  'weather',
  'crews_and_progress',
  'staff_headcount',
  'equipment',
  'materials',
  'work_summary',
  'quality_control',
  'site_visits_and_directives',
  'hse',
  'delays_and_blockers',
  'special_project_items',
  'tomorrow_plan',
  'free_notes',
]

export function siteReportHasContent(report: LipartaDailyReportData | null | undefined): boolean {
  if (!report) return false
  return CONTENT_SECTIONS.some((id) => !isSiteReportSectionEmpty(report, id))
}

/** Fallback raw_text when the free note field is empty but structured data exists. */
export function siteReportFallbackNote(report: LipartaDailyReportData): string {
  const parts: string[] = []
  const w = report.weather
  if (w.condition || w.location_name) {
    parts.push(
      [
        'وضعیت هوا:',
        w.location_name,
        w.condition,
        w.min_temp_c != null || w.max_temp_c != null
          ? `${w.min_temp_c ?? '—'} تا ${w.max_temp_c ?? '—'} درجه`
          : null,
      ]
        .filter(Boolean)
        .join(' - ')
    )
  }
  for (const c of report.crews_and_progress) {
    if (!c.activity_name && !c.contractor_or_crew) continue
    parts.push(
      [
        c.activity_name || 'فعالیت',
        c.contractor_or_crew,
        c.trade,
        c.work_done_today.quantity != null
          ? `${c.work_done_today.quantity} ${c.work_done_today.unit ?? ''}`.trim()
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    )
  }
  if (report.tomorrow_plan.planned_activities.length) {
    parts.push(`برنامه فردا: ${report.tomorrow_plan.planned_activities.join('؛ ')}`)
  }
  if (report.free_notes?.trim()) parts.push(report.free_notes.trim())
  return parts.join('\n') || 'گزارش ساختاریافته کارگاه'
}
