/**
 * @file features/site-report/lib/parse-structured.ts
 * @purpose پارس امن JSON ساختاریافته گزارش روزانه
 * @safe-to-edit YES
 * @affects workflow گزارش روزانه
 * @depends-on features/site-report/lib/types, features/site-report/lib/merge-report
 */

import { coerceSiteReport } from '@/features/site-report/lib/merge-report'
import type { LipartaDailyReportData } from '@/features/site-report/lib/types'

export function parseLipartaDailyReport(
  value: unknown,
  headerFallback?: Partial<LipartaDailyReportData['header']>
): LipartaDailyReportData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    return coerceSiteReport(value, headerFallback)
  } catch {
    return null
  }
}
