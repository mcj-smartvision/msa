'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { resolveVisibleWidgetKeys } from '@/utils/dashboard'
import { RoleDashboard } from '@/components/dashboard/role-dashboard'
import { LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import type { DashboardUserContext } from '@/types/dashboard'

export function DashboardClient({
  initialContext,
  visibleBlockCodes = [],
}: {
  initialContext: DashboardUserContext
  visibleBlockCodes?: string[]
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
      visibleBlockCodes={visibleBlockCodes}
      showAdminBlockCodes={context.isSystemAdmin}
    />
  )
}
