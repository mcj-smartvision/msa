'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ScheduleWorkspace } from '@/components/workshop/schedule-workspace'
import { ApprovalsWorkspace } from '@/components/workshop/approvals-workspace'
import { PreparedWorkspace } from '@/components/workshop/prepared-workspace'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'schedule', label: 'برنامه' },
  { id: 'approvals', label: 'تأییدات' },
  { id: 'prepared', label: 'لیست‌ها' },
] as const

type WorkshopTab = (typeof TABS)[number]['id']

export function WorkshopOpsPanel() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const embeddedInTechnicalOffice = pathname.includes('/dashboard/technical-office')
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const workshopTab = (searchParams.get('workshopTab') ?? 'schedule') as WorkshopTab
  const [readOnly, setReadOnly] = useState(asSupervisor)
  const projectId = searchParams.get('projectId') ?? ''

  const visibleTabs = asSupervisor
    ? TABS.filter((t) => t.id === 'schedule' || t.id === 'prepared')
    : TABS

  const activeTab = visibleTabs.some((t) => t.id === workshopTab)
    ? workshopTab
    : visibleTabs[0]?.id ?? 'schedule'

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/workshop/capabilities?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.readOnly === 'boolean') {
          setReadOnly(asSupervisor || data.readOnly)
        }
      })
      .catch(() => setReadOnly(asSupervisor))
  }, [projectId, asSupervisor])

  function tabHref(tab: WorkshopTab): string {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', 'schedule')
    params.set('workshopTab', tab)
    if (projectId) params.set('projectId', projectId)
    if (asSupervisor) params.set('as', 'supervisor')
    return `/dashboard/technical-office?${params.toString()}`
  }

  return (
    <div className="space-y-3 w-full max-w-full min-w-0" dir="rtl" lang="fa">
      <p className="text-sm text-slate-600 leading-relaxed">
        {readOnly
          ? 'نمای مشاهده — ویرایش زیرشاخه و برنامه فقط برای دفتر فنی است.'
          : 'برنامه MSP را ببینید، زیرشاخه تعریف کنید، مقدار وارد کنید و به امروز بفرستید.'}
      </p>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <a
              key={tab.id}
              href={tabHref(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </a>
          )
        })}
      </nav>

      {activeTab === 'schedule' ? (
        <ScheduleWorkspace showBanner={!embeddedInTechnicalOffice} />
      ) : null}
      {activeTab === 'approvals' && !asSupervisor ? (
        <ApprovalsWorkspace showBanner={!embeddedInTechnicalOffice} />
      ) : null}
      {activeTab === 'prepared' ? (
        <PreparedWorkspace showBanner={!embeddedInTechnicalOffice} />
      ) : null}
    </div>
  )
}
