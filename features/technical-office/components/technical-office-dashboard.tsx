/**
 * @file features/technical-office/components/technical-office-dashboard.tsx
 * @purpose کامپوننت UI — دفتر فنی (technical-office-dashboard)
 * @safe-to-edit CAREFUL
 * @affects دفتر فنی
 * @depends-on shared/components/i18n/locale-provider, shared/lib/i18n/technical-office, shared/types/dashboard, features/admin/components/shared, features/technical-office/components/technical-office-legacy-panel, features/technical-office/components/contractors-section, features/workshop/components/workshop-ops-panel, features/schedule/components/smart-progress-alerts-panel, shared/hooks/use-synced-project-id, shared/lib/utils
 */

'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getTechnicalOfficeMessages } from '@/shared/lib/i18n/technical-office'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import { PageHeader } from '@/features/admin/components/shared'
import { TechnicalOfficeLegacyPanel } from '@/features/technical-office/components/technical-office-legacy-panel'
import { ContractorsSection } from '@/features/technical-office/components/contractors-section'
import { WorkshopOpsPanel } from '@/features/workshop/components/workshop-ops-panel'
import { SmartProgressAlertsPanel } from '@/features/schedule/components/smart-progress-alerts-panel'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import { cn } from '@/shared/lib/utils'

type OfficeSection =
  | 'contractors'
  | 'office'
  | 'send-schedule'
  | 'schedule'
  | 'smart-progress'

function officeSections() {
  const fa = getTechnicalOfficeMessages('fa')
  const en = getTechnicalOfficeMessages('en')
  return [
    { id: 'contractors' as const, labelFa: fa.tabContractors, labelEn: en.tabContractors },
    { id: 'office' as const, labelFa: fa.tabDrawings, labelEn: en.tabDrawings },
    { id: 'send-schedule' as const, labelFa: fa.tabSendSchedule, labelEn: en.tabSendSchedule },
    { id: 'schedule' as const, labelFa: fa.tabEditSchedule, labelEn: en.tabEditSchedule },
    { id: 'smart-progress' as const, labelFa: fa.tabSmartProgress, labelEn: en.tabSmartProgress },
  ]
}

export function TechnicalOfficeDashboard({
  initialProjectId,
  projectOptions,
  scheduleSendPanel,
}: {
  initialContext: DashboardUserContext
  projectOptions: Array<{ id: string; name: string }>
  initialProjectId: string | null
  scheduleSendPanel?: React.ReactNode
}) {
  const { locale } = useLocale()
  const t = getTechnicalOfficeMessages(locale)
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = useSyncedProjectId(initialProjectId) ?? projectOptions[0]?.id ?? ''
  const fa = locale === 'fa' || locale === 'ar'
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const rawSection = searchParams.get('section')
  const section: OfficeSection =
    rawSection === 'schedule'
      ? 'schedule'
      : rawSection === 'send-schedule'
        ? 'send-schedule'
        : rawSection === 'smart-progress'
          ? 'smart-progress'
          : rawSection === 'contractors'
              ? 'contractors'
            : rawSection === 'office' || rawSection === 'drawings'
              ? 'office'
              : asSupervisor
                ? 'schedule'
                : 'office'

  const visibleSections = asSupervisor
    ? officeSections().filter((s) => s.id === 'schedule')
    : officeSections()

  useEffect(() => {
    if (!projectId) return
    const params = new URLSearchParams(searchParams.toString())
    const staleInvoice = params.get('section') === 'progress-invoice'
    if (params.get('projectId') === projectId && params.get('section') && !staleInvoice) return
    params.set('projectId', projectId)
    if (!params.get('section') || staleInvoice) {
      params.set('section', asSupervisor ? 'schedule' : 'office')
    }
    router.replace(`/dashboard/technical-office?${params.toString()}`)
  }, [projectId, router, searchParams, asSupervisor])

  function sectionHref(id: OfficeSection): string {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', id)
    if (projectId) params.set('projectId', projectId)
    if (asSupervisor) params.set('as', 'supervisor')
    if (id === 'schedule') {
      params.set('workshopTab', 'schedule')
    }
    return `/dashboard/technical-office?${params.toString()}`
  }

  const dir = fa ? 'rtl' : 'ltr'

  return (
    <div
      className={cn(
        'space-y-6',
        section === 'schedule' ||
          section === 'send-schedule' ||
          section === 'smart-progress' ||
          section === 'contractors'
          ? 'w-full max-w-none'
          : 'mx-auto max-w-6xl'
      )}
      dir={dir}
    >
      <PageHeader
        title={asSupervisor ? t.supervisorTitle : t.title}
        description={asSupervisor ? t.supervisorHint : t.subtitle}
      />

      <nav className="flex flex-wrap gap-2 pb-1">
        {visibleSections.map((item) => {
          const active = section === item.id
          const label = fa ? item.labelFa : item.labelEn
          return (
            <a
              key={item.id}
              href={sectionHref(item.id)}
              className={cn(
                'rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm',
                active
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
              )}
            >
              {label}
            </a>
          )
        })}
      </nav>

      {!projectId ? (
        <p className="text-sm text-muted-foreground">
          {t.pickProject}
        </p>
      ) : section === 'schedule' ? (
        <WorkshopOpsPanel />
      ) : section === 'smart-progress' ? (
        <SmartProgressAlertsPanel projectId={projectId} />
      ) : section === 'contractors' ? (
        <ContractorsSection projectId={projectId} />
      ) : section === 'office' ? (
        <TechnicalOfficeLegacyPanel projectId={projectId} />
      ) : null}

      {/* Keep SEND mounted so ویرایش → ارسال sync applies without remount/stale SSR */}
      {projectId && scheduleSendPanel ? (
        <div
          className={section === 'send-schedule' ? 'block' : 'hidden'}
          aria-hidden={section !== 'send-schedule'}
        >
          {scheduleSendPanel}
        </div>
      ) : null}
    </div>
  )
}
