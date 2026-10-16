/**
 * @file app/(dashboard)/admin/projects/[projectId]/routing/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/hooks/use-supabase, features/admin/services/admin, features/admin/components/shared, features/admin/components/notification-route-editor, shared/types/admin
 */

'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import {
deleteNotificationRoute,
fetchEventTypes,
fetchNotificationRoutes,
fetchPositions,
upsertNotificationRoute,
} from '@/features/admin/services/admin'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { NotificationRouteEditor } from '@/features/admin/components/notification-route-editor'
import type { EventType, NotificationRoute, Position } from '@/shared/types/admin'
import { ADMIN_COPY } from '@/features/admin/config'

export default function ProjectRoutingPage({ params }: { params: { projectId: string } }) {
  const supabase = useSupabase()
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [routes, setRoutes] = useState<NotificationRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const [eventData, positionData, routeData] = await Promise.all([
      fetchEventTypes(supabase),
      fetchPositions(supabase, params.projectId),
      fetchNotificationRoutes(supabase, params.projectId),
    ])
    setEventTypes(eventData)
    setPositions(positionData.filter((position) => position.is_active))
    setRoutes(routeData)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadData()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : ADMIN_COPY.loadRoutingFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.projectId])

  if (loading) return <LoadingBlock label={ADMIN_COPY.loadingRouting} />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={ADMIN_COPY.routingTitle}
        description={ADMIN_COPY.routingHint}
      />

      <NotificationRouteEditor
        eventTypes={eventTypes}
        positions={positions}
        routes={routes}
        onSave={async (payload) => {
          await upsertNotificationRoute(supabase, params.projectId, payload)
          await loadData()
        }}
        onDelete={async (routeId) => {
          await deleteNotificationRoute(supabase, routeId)
          await loadData()
        }}
      />
    </div>
  )
}
