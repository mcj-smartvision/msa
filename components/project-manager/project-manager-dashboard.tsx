'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { EmptyState, PageHeader } from '@/components/admin/shared'
import { getProjectManagerMessages } from '@/lib/i18n/project-manager'
import type { DashboardUserContext } from '@/types/dashboard'
import type { ProjectEvmSnapshot } from '@/lib/evm/load-project-evm'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import { cn } from '@/lib/utils'
import { RagStatusBadge } from './rag-status-badge'
import { EvmKpiWidgets } from './evm-kpi-widgets'
import { EvmSourcesButton } from './evm-sources-dialog'
import { ControlsKpiCards, ScheduleSpiCard, useProjectControls } from './controls-kpi-cards'

interface ProjectManagerDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
}

function useProjectEvm(projectId: string | null) {
  const [snapshot, setSnapshot] = useState<ProjectEvmSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/project-manager/evm?projectId=${encodeURIComponent(projectId)}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'بارگذاری شاخص‌های EVM ناموفق بود')
      setSnapshot(data as ProjectEvmSnapshot)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'بارگذاری شاخص‌های EVM ناموفق بود')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setSnapshot(null)
    void load()
  }, [load])

  return { snapshot, loading, error, reload: load }
}

export function ProjectManagerDashboard({
  projectOptions,
  initialProjectId,
}: ProjectManagerDashboardProps) {
  const { locale, dir } = useLocale()
  const t = getProjectManagerMessages(locale)
  const projectId = useSyncedProjectId(initialProjectId)
  const { snapshot, loading, error, reload } = useProjectEvm(projectId)
  const controls = useProjectControls(projectId)
  const reloadAll = useCallback(() => Promise.all([reload(), controls.reload()]).then(() => undefined), [reload, controls.reload])

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description={
          locale === 'fa' || locale === 'ar'
            ? 'از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند.'
            : 'Ask an admin to assign you as Project Manager on a project.'
        }
      />
    )
  }

  return (
    <div className={cn('space-y-6', dir === 'rtl' && 'text-right')} dir={dir}>
      <PageHeader title={t.title} description={t.description} />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <h2 className="text-lg font-bold text-slate-900">{t.executiveTitle}</h2>
              <EvmSourcesButton snapshot={snapshot} />
            </div>
            {snapshot ? <RagStatusBadge rag={snapshot.rag} /> : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {snapshot ? <span>{t.asOf(snapshot.metrics.asOf)}</span> : null}
            <button
              type="button"
              onClick={() => void reloadAll()}
              disabled={loading || !projectId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t.refresh}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {snapshot ? (
          <EvmKpiWidgets metrics={snapshot.metrics} float={snapshot.float} scheduleCard={<ScheduleSpiCard state={controls} />} />
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </div>
        ) : null}
      </section>

      <ControlsKpiCards state={controls} />
    </div>
  )
}
