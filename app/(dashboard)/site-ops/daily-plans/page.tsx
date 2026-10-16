/**
 * @file app/(dashboard)/site-ops/daily-plans/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/daily-plans-client
 */

import { DailyPlansClient } from '@/features/site-ops/components/daily-plans-client'

export default function SiteOpsDailyPlansPage() {
  return <DailyPlansClient />
}
