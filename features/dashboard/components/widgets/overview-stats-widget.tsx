/**
 * @file features/dashboard/components/widgets/overview-stats-widget.tsx
 * @purpose ویجت خلاصه روزانه: تعداد گزارش، اعضا، نقش و وضعیت پروژه
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها
 * @depends-on features/dashboard/config.ts, features/dashboard/services/dashboard, shared/lib/dashboard/roles, shared/types/dashboard
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { fetchDashboardStats } from '@/features/dashboard/services/dashboard'
import { SITE_ROLE_LABELS, type SiteRoleKey } from '@/shared/lib/dashboard/roles'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { OVERVIEW_STATS_COPY } from '@/features/dashboard/config'

type OverviewCounts = { reportCount: number; memberCount: number }

/**
 * Daily snapshot for the active project: report count, team size, role, status.
 */
export function OverviewStatsWidget({ context }: { context: WidgetRenderContext }) {
  const copy = OVERVIEW_STATS_COPY
  const supabase = useSupabase()
  const [stats, setStats] = useState<OverviewCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!context.projectId) {
      setLoading(false)
      return
    }
    fetchDashboardStats(supabase, context.projectId)
      .then((data) => setStats(data))
      .finally(() => setLoading(false))
  }, [context.projectId, supabase])

  const roleKey = context.user.primaryRole as SiteRoleKey | undefined
  const roleLabel = roleKey ? SITE_ROLE_LABELS[roleKey] ?? copy.fallbackRole : copy.fallbackRole

  return (
    <WidgetShell title={copy.title} description={copy.description}>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !context.projectId ? (
        <p className="text-sm text-muted-foreground">{copy.noProject}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat label={copy.labels.reports} value={String(stats?.reportCount ?? 0)} />
          <Stat label={copy.labels.members} value={String(stats?.memberCount ?? 0)} />
          <Stat label={copy.labels.role} value={roleLabel} />
          <Stat label={copy.labels.status} value={copy.activeStatus} />
        </div>
      )}
      <Link href="/reports" className="text-xs text-primary underline mt-4 inline-block">
        {copy.allReports}
      </Link>
    </WidgetShell>
  )
}

/** Compact label/value tile inside the overview widget. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </div>
  )
}
