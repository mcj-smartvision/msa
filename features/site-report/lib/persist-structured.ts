/**
 * @file features/site-report/lib/persist-structured.ts
 * @purpose خواندن/نوشتن structured_json روی daily_reports
 * @safe-to-edit CAREFUL
 * @affects گزارش ساختاریافته
 * @depends-on features/site-report/lib/merge-report, features/site-report/lib/types
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { coerceSiteReport } from '@/features/site-report/lib/merge-report'
import type { LipartaDailyReportData } from '@/features/site-report/lib/types'

const STRUCTURED_MISSING = /structured_json|schema cache|column/i

export async function loadStructuredReport(
  supabase: SupabaseClient,
  reportId: string
): Promise<LipartaDailyReportData | null> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('structured_json, report_no, report_date')
    .eq('id', reportId)
    .maybeSingle()
  if (error) {
    if (STRUCTURED_MISSING.test(error.message)) return null
    throw new Error(error.message)
  }
  if (!data?.structured_json) return null
  return coerceSiteReport(data.structured_json)
}

export async function saveStructuredReport(
  supabase: SupabaseClient,
  reportId: string,
  report: LipartaDailyReportData
): Promise<void> {
  const { error } = await supabase
    .from('daily_reports')
    .update({ structured_json: report } as never)
    .eq('id', reportId)
  if (error) {
    if (STRUCTURED_MISSING.test(error.message)) {
      throw new Error('migration_required: database/114-daily-report-structured.sql را اجرا کنید')
    }
    throw new Error(error.message)
  }
}
