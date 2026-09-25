'use client'

import { Component, useState, type ReactNode } from 'react'
import { useLocale } from '@/components/i18n/locale-provider'
import { EmptyState, PageHeader } from '@/components/admin/shared'
import { OverheadCostsMatrix } from '@/components/finance/overhead-costs-matrix'
import { OverheadPerCapitaTable } from '@/components/finance/overhead-per-capita-table'
import { ContractorWorkshopCosts } from '@/components/finance/contractor-workshop-costs'
import { LiveWorkshopCosts } from '@/components/finance/live-workshop-costs'
import { getAccountantMessages } from '@/lib/i18n/accountant'
import { cn } from '@/lib/utils'
import type { DashboardUserContext } from '@/types/dashboard'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'

interface AccountantDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  canEdit?: boolean
}

type AccountantTab = 'live-costs' | 'overhead' | 'contractor-costs' | 'overhead-per-capita'

export function AccountantDashboard({
  projectOptions,
  initialProjectId,
}: AccountantDashboardProps) {
  const { locale, dir } = useLocale()
  const t = getAccountantMessages(locale)
  const fa = locale === 'fa' || locale === 'ar'
  const projectId = useSyncedProjectId(initialProjectId)

  const [tab, setTab] = useState<AccountantTab>('live-costs')
  const [overheadMonths, setOverheadMonths] = useState<{ labels: string[]; totals: number[] }>({
    labels: [],
    totals: [],
  })

  if (projectOptions.length === 0) {
    return <EmptyState title={t.title} description={t.noProject} />
  }

  return (
    <div className="space-y-8" dir={dir}>
      <PageHeader
        title={t.title}
        description={
          tab === 'live-costs'
            ? t.liveCostsDescription
            : tab === 'contractor-costs'
              ? t.contractorCostsDescription
              : tab === 'overhead-per-capita'
                ? t.overheadPerCapitaDescription
                : t.overheadDescription
        }
      />

      <nav className="flex flex-wrap gap-2 pb-1" role="tablist" aria-label={t.title}>
        <TabButton active={tab === 'live-costs'} onClick={() => setTab('live-costs')}>
          {t.liveCostsTab}
        </TabButton>
        <TabButton active={tab === 'overhead'} onClick={() => setTab('overhead')}>
          {t.overheadTab}
        </TabButton>
        <TabButton active={tab === 'contractor-costs'} onClick={() => setTab('contractor-costs')}>
          {t.contractorCostsTab}
        </TabButton>
        <TabButton
          active={tab === 'overhead-per-capita'}
          onClick={() => setTab('overhead-per-capita')}
        >
          {t.overheadPerCapitaTab}
        </TabButton>
      </nav>

      <div className={tab === 'live-costs' ? undefined : 'hidden'}>
        <LiveWorkshopCosts fa={fa} projectId={projectId} />
      </div>
      <div className={tab === 'overhead' ? undefined : 'hidden'}>
        <OverheadCostsMatrix
          fa={fa}
          projectId={projectId}
          onMonthTotalsChange={setOverheadMonths}
        />
      </div>
      <div className={tab === 'overhead-per-capita' ? undefined : 'hidden'}>
        <PerCapitaTabErrorBoundary fa={fa}>
          <OverheadPerCapitaTable
            fa={fa}
            projectId={projectId}
            monthLabels={overheadMonths.labels}
            monthTotals={overheadMonths.totals}
          />
        </PerCapitaTabErrorBoundary>
      </div>
      <div className={tab === 'contractor-costs' ? undefined : 'hidden'}>
        <ContractorWorkshopCosts fa={fa} projectId={projectId} />
      </div>
    </div>
  )
}

class PerCapitaTabErrorBoundary extends Component<
  { fa: boolean; children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'render-error' }
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-red-600">
          {this.props.fa
            ? `جدول سرانه بالا نیامد: ${this.state.error}`
            : `Per-capita table failed: ${this.state.error}`}
        </p>
      )
    }
    return this.props.children
  }
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition',
        active
          ? 'bg-orange-500 text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  )
}
