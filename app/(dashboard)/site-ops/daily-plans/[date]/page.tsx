/**
 * @file app/(dashboard)/site-ops/daily-plans/[date]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/daily-plan-detail-client
 */

import { DailyPlanDetailClient } from '@/features/site-ops/components/daily-plan-detail-client'

export default function SiteOpsDailyPlanDatePage() {
  return <DailyPlanDetailClient />
}
