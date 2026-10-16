/**
 * @file app/(dashboard)/site-ops/reports/daily/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/daily-report-client
 */

import { DailyReportClient } from '@/features/site-ops/components/daily-report-client'

export default function SiteOpsDailyReportPage() {
  return <DailyReportClient />
}
