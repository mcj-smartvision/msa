import { loadManagerPageProps } from '@/lib/manager/page-props'
import { ManagerDashboard } from '@/components/manager/manager-dashboard'

export default async function ManagerAlertsPage() {
  const props = await loadManagerPageProps()
  return <ManagerDashboard {...props} view="alerts" />
}
