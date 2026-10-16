/**
 * @file app/(dashboard)/dashboard/site-supervisor/safety-alerts/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/hse/components/safety-alerts-page
 */

import { SafetyAlertsPage } from '@/features/hse/components/safety-alerts-page'

/** پیش‌نمایش UI — بدون API */
export default function SiteSupervisorSafetyAlertsPreviewPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <SafetyAlertsPage />
    </div>
  )
}
