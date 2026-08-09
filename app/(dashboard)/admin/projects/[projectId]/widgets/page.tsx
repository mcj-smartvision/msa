'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import {
  fetchDashboardUiBlocks,
  fetchDashboardWidgets,
  fetchPositionUiBlockVisibility,
  fetchPositionWidgets,
  fetchPositions,
  upsertUiBlockVisibility,
  upsertWidgetVisibility,
} from '@/utils/admin'
import { getCatalogStats } from '@/lib/dashboard/ui-block-catalog'
import { PageHeader, LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { WidgetVisibilityEditor } from '@/components/admin/widget-visibility-editor'
import { UiBlockVisibilityEditor } from '@/components/admin/ui-block-visibility-editor'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type {
  DashboardUiBlock,
  DashboardWidget,
  Position,
  PositionDashboardWidget,
  PositionUiBlockVisibility,
} from '@/types/admin'

type TabId = 'ui-blocks' | 'legacy-widgets'

export default function ProjectWidgetsPage({ params }: { params: { projectId: string } }) {
  const supabase = useSupabase()
  const [tab, setTab] = useState<TabId>('ui-blocks')
  const [positions, setPositions] = useState<Position[]>([])
  const [widgets, setWidgets] = useState<DashboardWidget[]>([])
  const [widgetAssignments, setWidgetAssignments] = useState<PositionDashboardWidget[]>([])
  const [uiBlocks, setUiBlocks] = useState<DashboardUiBlock[]>([])
  const [blockAssignments, setBlockAssignments] = useState<PositionUiBlockVisibility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const catalogStats = getCatalogStats()

  async function loadData() {
    const [positionData, widgetData, widgetAssignmentData, blockData, blockAssignmentData] =
      await Promise.all([
        fetchPositions(supabase, params.projectId),
        fetchDashboardWidgets(supabase),
        fetchPositionWidgets(supabase, params.projectId),
        fetchDashboardUiBlocks(supabase),
        fetchPositionUiBlockVisibility(supabase, params.projectId),
      ])
    setPositions(positionData.filter((position) => position.is_active))
    setWidgets(widgetData)
    setWidgetAssignments(widgetAssignmentData)
    setUiBlocks(blockData)
    setBlockAssignments(blockAssignmentData)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadData()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری تنظیمات نمایش ناموفق بود')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.projectId])

  if (loading) return <LoadingBlock label="در حال بارگذاری تنظیمات نمایش..." />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="نمایش داشبورد"
        description="مشخص کنید کدام ماژول‌ها، نمودارها، جداول و پنل‌های داشبورد برای هر سمت قابل‌نمایش باشند."
      />

      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setTab('ui-blocks')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'ui-blocks' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          بلوک‌های UI
          <Badge variant="secondary" className="ms-2 text-[10px]">
            {uiBlocks.length || catalogStats.total}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setTab('legacy-widgets')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            tab === 'legacy-widgets'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          ویجت‌های قدیمی
          <Badge variant="secondary" className="ms-2 text-[10px]">
            {widgets.length}
          </Badge>
        </button>
      </div>

      {tab === 'ui-blocks' ? (
        uiBlocks.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 space-y-2">
            <p className="font-semibold">کاتالوگ UI هنوز در دیتابیس seed نشده</p>
            <p className="text-sm text-muted-foreground">
              migration های <code className="text-xs">32-ui-block-catalog.sql</code> و{' '}
              <code className="text-xs">33-seed-ui-blocks.sql</code> را در Supabase اجرا کنید.
              ({catalogStats.total} بلوک در کاتالوگ اپ)
            </p>
          </div>
        ) : (
          <UiBlockVisibilityEditor
            positions={positions}
            blocks={uiBlocks}
            assignments={blockAssignments}
            onSave={async (payload) => {
              await upsertUiBlockVisibility(supabase, payload)
              await loadData()
            }}
          />
        )
      ) : (
        <WidgetVisibilityEditor
          positions={positions}
          widgets={widgets}
          assignments={widgetAssignments}
          onSave={async (payload) => {
            await upsertWidgetVisibility(supabase, payload)
            await loadData()
          }}
        />
      )}
    </div>
  )
}
