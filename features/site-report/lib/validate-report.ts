/**
 * @file features/site-report/lib/validate-report.ts
 * @purpose علامت‌گذاری اختیاری requires_completion روی ردیف اکیپ (بدون بلاک ارسال)
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/types
 */

import type { LipartaDailyReportData, SiteReportCrewRow } from '@/features/site-report/lib/types'

function markCrew(row: SiteReportCrewRow): SiteReportCrewRow {
  const missing =
    row.headcount == null ||
    row.regular_hours == null ||
    row.work_done_today.quantity == null ||
    !row.work_done_today.unit?.trim()
  return { ...row, requires_completion: missing }
}

/** Stamp requires_completion on crew rows with missing quantities/units (hint only). */
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

/** No section is required — always ok for send. */
export function checkSiteReportReadyToSend(report: LipartaDailyReportData): SiteReportSubmitCheck {
  const stamped = stampRequiresCompletion(report)
  return {
    ok: true,
    missingMandatory: [],
    incompleteCrewCount: stamped.crews_and_progress.filter((r) => r.requires_completion).length,
  }
}
