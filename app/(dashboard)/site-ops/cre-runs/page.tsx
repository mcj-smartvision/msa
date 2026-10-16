/**
 * @file app/(dashboard)/site-ops/cre-runs/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/cre-runs-client
 */

import { CreRunsClient } from '@/features/site-ops/components/cre-runs-client'

export default function SiteOpsCreRunsPage() {
  return <CreRunsClient />
}
