import { loadManagerPageProps } from '@/lib/manager/page-props'
import { ManagerDashboard } from '@/components/manager/manager-dashboard'

export default async function ManagerDashboardPage() {
  const props = await loadManagerPageProps()
  return <ManagerDashboard {...props} view="home" />
}
