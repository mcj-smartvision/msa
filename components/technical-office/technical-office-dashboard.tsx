'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from '@/components/i18n/locale-provider'
import { getTechnicalOfficeMessages } from '@/lib/i18n/technical-office'
import type { DashboardUserContext } from '@/types/dashboard'
import { PageHeader } from '@/components/admin/shared'
import { TechnicalOfficeLegacyPanel } from '@/components/technical-office/technical-office-legacy-panel'
import { WorkshopOpsPanel } from '@/components/workshop/workshop-ops-panel'
import { useSyncedProjectId } from '@/hooks/use-synced-project-id'
import { cn } from '@/lib/utils'

type OfficeSection = 'office' | 'send-schedule' | 'schedule'

const SECTIONS: { id: OfficeSection; labelFa: string; labelEn: string }[] = [
  { id: 'office', labelFa: 'نقشه‌ها', labelEn: 'Drawings' },
  { id: 'send-schedule', labelFa: 'ارسال برنامه زمانبندی', labelEn: 'Send schedule' },
  { id: 'schedule', labelFa: 'ویرایش برنامه زمانبندی', labelEn: 'Edit schedule' },
]

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
        : rawSection === 'office' || rawSection === 'drawings'
          ? 'office'
          : asSupervisor
            ? 'schedule'
            : 'office'

  const visibleSections = asSupervisor
    ? SECTIONS.filter((s) => s.id === 'schedule')
    : SECTIONS

  useEffect(() => {
    if (!projectId) return
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('projectId') === projectId && params.get('section')) return
    params.set('projectId', projectId)
    if (!params.get('section')) {
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
        section === 'schedule' ? 'w-full max-w-none' : 'mx-auto max-w-6xl'
      )}
      dir={dir}
    >
      <PageHeader
        title={asSupervisor ? (fa ? 'مشاهده برنامه کارگاه' : 'Workshop schedule view') : t.title}
        description={
          asSupervisor
            ? fa
              ? 'نمای سرپرست — فقط مشاهده برنامه و لیست‌های دفتر فنی.'
              : 'Supervisor view — read-only schedule and lists.'
            : t.subtitle
        }
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
          {fa ? 'ابتدا یک پروژه انتخاب کنید.' : 'Select a project first.'}
        </p>
      ) : section === 'schedule' ? (
        <WorkshopOpsPanel />
      ) : section === 'send-schedule' ? (
        scheduleSendPanel
      ) : (
        <TechnicalOfficeLegacyPanel projectId={projectId} />
      )}
    </div>
  )
}
