/**
 * @file app/(dashboard)/dashboard/site-supervisor/daily-reports/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/supervisor/components/daily-report-history-page
 */

import { Suspense } from 'react'
import { DailyReportHistoryPage } from '@/features/supervisor/components/daily-report-history-page'
import { COMMON_UI } from '@/shared/lib/i18n/common-ui'

export default function SiteSupervisorDailyReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-600">
          {COMMON_UI.loading}
        </div>
      }
    >
      <DailyReportHistoryPage />
    </Suspense>
  )
}
