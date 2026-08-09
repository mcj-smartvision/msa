'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/hooks/useSupabase'
import { fetchDashboardStats } from '@/utils/dashboard'
import { SITE_ROLE_LABELS, type SiteRoleKey } from '@/lib/dashboard/roles'
import type { WidgetRenderContext } from '@/types/dashboard'
import { WidgetShell } from '@/components/widgets/widget-shell'
import { Skeleton } from '@/components/ui/skeleton'

export function OverviewStatsWidget({ context }: { context: WidgetRenderContext }) {
  const supabase = useSupabase()
  const [stats, setStats] = useState<{ reportCount: number; memberCount: number } | null>(null)
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
  const roleLabel = roleKey ? SITE_ROLE_LABELS[roleKey] ?? 'عضو' : 'عضو'

  return (
    <WidgetShell title="خلاصه روزانه" description="نمای کلی پروژه در یک نگاه">
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !context.projectId ? (
        <p className="text-sm text-muted-foreground">پروژه فعالی اختصاص داده نشده است.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="گزارش‌ها" value={String(stats?.reportCount ?? 0)} />
          <Stat label="اعضای تیم" value={String(stats?.memberCount ?? 0)} />
          <Stat label="نقش" value={roleLabel} />
          <Stat label="وضعیت" value="فعال" />
        </div>
      )}
      <Link href="/reports" className="text-xs text-primary underline mt-4 inline-block">
        مشاهده همه گزارش‌ها
      </Link>
    </WidgetShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </div>
  )
}
