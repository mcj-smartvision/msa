/**
 * @file app/(dashboard)/site-ops/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/overview-client
 */

import { SiteOpsOverviewClient } from '@/features/site-ops/components/overview-client'

export default function SiteOpsPage() {
  return <SiteOpsOverviewClient />
}
