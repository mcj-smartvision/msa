import { Suspense } from 'react'
import { DailyReportHistoryPage } from '@/components/supervisor/daily-report-history-page'

export default function SiteSupervisorDailyReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-600" dir="rtl" lang="fa">
          در حال بارگذاری…
        </div>
      }
    >
      <DailyReportHistoryPage />
    </Suspense>
  )
}
