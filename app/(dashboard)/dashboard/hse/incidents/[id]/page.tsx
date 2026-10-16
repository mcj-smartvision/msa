/**
 * @file app/(dashboard)/dashboard/hse/incidents/[id]/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on features/hse/components/incident-detail-page
 */

import { IncidentDetailPage } from '@/features/hse/components/incident-detail-page'

export default function HseIncidentDetailRoute({
  params,
}: {
  params: { id: string }
}) {
  return <IncidentDetailPage id={params.id} />
}
