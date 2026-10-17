/**
 * @file features/site-report/lib/validate-report.ts
 * @purpose علامت‌گذاری requires_completion و بررسی الزامات قبل از ارسال
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/types, features/site-report/lib/section-visibility
 */

import { isSiteReportSectionEmpty } from '@/features/site-report/lib/section-visibility'
import type { LipartaDailyReportData, SiteReportCrewRow } from '@/features/site-report/lib/types'

function markCrew(row: SiteReportCrewRow): SiteReportCrewRow {
  const missing =
    row.headcount == null ||
    row.regular_hours == null ||
    row.work_done_today.quantity == null ||
    !row.work_done_today.unit?.trim()
  return { ...row, requires_completion: missing }
}

/** Stamp requires_completion on crew rows with missing quantities/units. */
export function stampRequiresCompletion(report: LipartaDailyReportData): LipartaDailyReportData {
  return {
    ...report,
    crews_and_progress: report.crews_and_progress.map(markCrew),
  }
}

export type SiteReportSubmitCheck = {
  ok: boolean
  missingMandatory: Array<'weather' | 'crews_and_progress' | 'tomorrow_plan'>
  incompleteCrewCount: number
}

export function checkSiteReportReadyToSend(report: LipartaDailyReportData): SiteReportSubmitCheck {
  const stamped = stampRequiresCompletion(report)
  const missingMandatory: SiteReportSubmitCheck['missingMandatory'] = []
  if (isSiteReportSectionEmpty(stamped, 'weather')) missingMandatory.push('weather')
  if (isSiteReportSectionEmpty(stamped, 'crews_and_progress')) missingMandatory.push('crews_and_progress')
  if (isSiteReportSectionEmpty(stamped, 'tomorrow_plan')) missingMandatory.push('tomorrow_plan')
  const incompleteCrewCount = stamped.crews_and_progress.filter((r) => r.requires_completion).length
  return {
    ok: missingMandatory.length === 0,
    missingMandatory,
    incompleteCrewCount,
  }
}
