/**
 * @file app/(dashboard)/site-ops/cre-runs/[id]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/cre-run-detail-client
 */

import { CreRunDetailClient } from '@/features/site-ops/components/cre-run-detail-client'

export default function SiteOpsCreRunDetailPage() {
  return <CreRunDetailClient />
}
