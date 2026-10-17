/**
 * @file features/site-report/lib/mandatory-labels.ts
 * @purpose برچسب فارسی بخش‌های الزامی ناقص
 * @safe-to-edit YES
 * @affects پیام خطای ارسال گزارش روزانه
 * @depends-on features/site-report/config, features/site-report/lib/validate-report
 */

import { SITE_REPORT_SECTION_LABELS } from '@/features/site-report/config'
import type { SiteReportSubmitCheck } from '@/features/site-report/lib/validate-report'

export function formatMissingMandatoryFa(
  missing: SiteReportSubmitCheck['missingMandatory']
): string {
  return missing.map((id) => SITE_REPORT_SECTION_LABELS[id] ?? id).join('، ')
}
