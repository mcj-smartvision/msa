/**
 * @file app/(dashboard)/admin/projects/[projectId]/widgets/page.tsx
 * @purpose کامپوننت UI — مسیرها و layout (page)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/hooks/use-supabase, features/admin/services/admin, features/admin/components/shared, features/admin/components/widget-visibility-editor, shared/types/admin
 */

'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import {
fetchDashboardWidgets,
fetchPositionWidgets,
fetchPositions,
upsertWidgetVisibility,
} from '@/features/admin/services/admin'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { WidgetVisibilityEditor } from '@/features/admin/components/widget-visibility-editor'
import type { DashboardWidget, Position, PositionDashboardWidget } from '@/shared/types/admin'
import { ADMIN_COPY } from '@/features/admin/config'

export default function ProjectWidgetsPage({ params }: { params: { projectId: string } }) {
  const supabase = useSupabase()
  const [positions, setPositions] = useState<Position[]>([])
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [widgetAssignments, setWidgetAssignments] = useState<PositionDashboardWidget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const [positionData, widgetData, widgetAssignmentData] = await Promise.all([
      fetchPositions(supabase, params.projectId),
      fetchDashboardWidgets(supabase),
      fetchPositionWidgets(supabase, params.projectId),
    ])
    setPositions(positionData.filter((position) => position.is_active))
    setWidgets(widgetData)
    setWidgetAssignments(widgetAssignmentData)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadData()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : ADMIN_COPY.loadWidgetsFailed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.projectId])

  if (loading) return <LoadingBlock label={ADMIN_COPY.loadingWidgets} />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={ADMIN_COPY.widgetsTitle}
        description={ADMIN_COPY.widgetsHint}
      />

      <WidgetVisibilityEditor
        positions={positions}
        widgets={widgets}
        assignments={widgetAssignments}
        onSave={async (payload) => {
          await upsertWidgetVisibility(supabase, payload)
          await loadData()
        }}
      />
    </div>
  )
}
