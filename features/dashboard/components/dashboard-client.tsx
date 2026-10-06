'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { resolveVisibleWidgetKeys } from '@/features/dashboard/services/dashboard'
import { RoleDashboard } from '@/features/dashboard/components/role-dashboard'
import { LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import type { DashboardUserContext } from '@/shared/types/dashboard'

export function DashboardClient({
  initialContext,
}: {
  initialContext: DashboardUserContext
}) {
  const supabase = useSupabase()
  const [context, setContext] = useState(initialContext)
  const [widgetKeys, setWidgetKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWidgets = useCallback(
    async (ctx: DashboardUserContext) => {
      const active = ctx.projects.find((p) => p.project.id === ctx.activeProjectId)
      const positionIds = active?.positions.map((p) => p.id) ?? []

      const keys = await resolveVisibleWidgetKeys(
        supabase,
        ctx.activeProjectId ?? '',
        positionIds,
        ctx.primaryRole
      )
      setWidgetKeys(keys)
    },
    [supabase]
  )

  useEffect(() => {
    setContext(initialContext)
  }, [initialContext])

  useEffect(() => {
    loadWidgets(context)
      .catch((err) => setError(err instanceof Error ? err.message : 'بارگذاری داشبورد ناموفق بود'))
      .finally(() => setLoading(false))
  }, [context, loadWidgets])

  if (loading && widgetKeys.length === 0) {
    return <LoadingBlock label="در حال بارگذاری داشبورد شما..." />
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={() => loadWidgets(context)} />
  }

  return (
    <RoleDashboard
      context={{ user: context, projectId: context.activeProjectId }}
      widgetKeys={widgetKeys}
    />
  )
}
