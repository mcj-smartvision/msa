/**
 * @file app/(dashboard)/site-ops/work-orders/[id]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/site-ops/components/work-order-client
 */

import { WorkOrderClient } from '@/features/site-ops/components/work-order-client'

export default function SiteOpsWorkOrderPage() {
  return <WorkOrderClient />
}
