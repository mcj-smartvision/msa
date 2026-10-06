import { IncidentDetailPage } from '@/features/hse/components/incident-detail-page'

export default function HseIncidentDetailRoute({
  params,
}: {
  params: { id: string }
}) {
  return <IncidentDetailPage id={params.id} />
}
