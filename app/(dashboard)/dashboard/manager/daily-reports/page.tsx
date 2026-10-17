/**
 * @file app/(dashboard)/dashboard/manager/daily-reports/page.tsx
 * @purpose مسیر تأیید گزارش روزانه مدیر پروژه
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/manager/lib/page-props, features/manager/components/manager-daily-reports-page
 */

import { Suspense } from 'react'
import { loadManagerPageProps } from '@/features/manager/lib/page-props'
import { ManagerDailyReportsPage } from '@/features/manager/components/manager-daily-reports-page'
import { MANAGER_DAILY_REPORTS_COPY } from '@/features/manager/lib/daily-reports-config'

export default async function ManagerDailyReportsRoute() {
  const props = await loadManagerPageProps()
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-slate-600" dir="rtl" lang="fa">
          {MANAGER_DAILY_REPORTS_COPY.loading}
        </div>
      }
    >
      <ManagerDailyReportsPage initialProjectId={props.initialProjectId} />
    </Suspense>
  )
}
