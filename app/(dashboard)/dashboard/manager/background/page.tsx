import { loadManagerPageProps } from '@/features/manager/lib/page-props'
import { ManagerDashboard } from '@/features/manager/components/manager-dashboard'

export default async function ManagerBackgroundPage() {
  const props = await loadManagerPageProps()
  return <ManagerDashboard {...props} view="background" />
}
