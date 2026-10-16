/**
 * @file app/(dashboard)/dashboard/manager/estimate/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/manager/lib/page-props, features/manager/components/manager-dashboard
 */

import { loadManagerPageProps } from '@/features/manager/lib/page-props'
import { ManagerDashboard } from '@/features/manager/components/manager-dashboard'

export default async function ManagerEstimatePage() {
  const props = await loadManagerPageProps()
  return <ManagerDashboard {...props} view="estimate" />
}
