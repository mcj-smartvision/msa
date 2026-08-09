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
    loadWidgets(context)
      .catch((err) => setError(err instanceof Error ? err.message : 'بارگذاری داشبورد ناموفق بود'))
      .finally(() => setLoading(false))
  }, [context, loadWidgets])

  async function handleProjectChange(projectId: string) {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) return

      const next = await fetchDashboardUserContext(supabase, user.id, user.email, projectId)
      setContext(next)
      await loadWidgets(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر پروژه ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

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
      onProjectChange={handleProjectChange}
    />
  )
}
