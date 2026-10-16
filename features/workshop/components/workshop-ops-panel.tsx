/**
 * @file features/workshop/components/workshop-ops-panel.tsx
 * @purpose کامپوننت UI — بسته‌های اجرایی و تأیید کارگاه (workshop-ops-panel)
 * @safe-to-edit CAREFUL
 * @affects بسته‌های اجرایی و تأیید کارگاه
 * @depends-on features/workshop/components/schedule-workspace, features/workshop/components/weight-deduction-workspace, features/schedule/components/schedule-gantt-workspace, features/workshop/components/dependency-network-workspace, features/workshop/components/approvals-workspace, features/workshop/components/prepared-workspace, shared/lib/utils
 */

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ScheduleWorkspace } from '@/features/workshop/components/schedule-workspace'
import { WeightDeductionWorkspace } from '@/features/workshop/components/weight-deduction-workspace'
import { ScheduleGanttWorkspace } from '@/features/schedule/components/schedule-gantt-workspace'
import { DependencyNetworkWorkspace } from '@/features/workshop/components/dependency-network-workspace'
import { ApprovalsWorkspace } from '@/features/workshop/components/approvals-workspace'
import { PreparedWorkspace } from '@/features/workshop/components/prepared-workspace'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { WORKSHOP_COPY } from '@/features/workshop/lib/ui-copy'

const TABS = [
  { id: 'schedule', label: WORKSHOP_COPY.ops.tabSchedule },
  { id: 'weight-deduction', label: WORKSHOP_COPY.ops.tabWeight },
  { id: 'gantt', label: WORKSHOP_COPY.ops.tabGantt },
  { id: 'dependencies', label: WORKSHOP_COPY.ops.tabDependencies },
  { id: 'approvals', label: WORKSHOP_COPY.ops.tabApprovals },
  { id: 'prepared', label: WORKSHOP_COPY.ops.tabPrepared },
] as const

type WorkshopTab = (typeof TABS)[number]['id']

export function WorkshopOpsPanel() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const embeddedInTechnicalOffice = pathname.includes('/dashboard/technical-office')
  const asSupervisor = searchParams.get('as') === 'supervisor'
  const workshopTab = (searchParams.get('workshopTab') ?? 'schedule') as WorkshopTab
  const [readOnly, setReadOnly] = useState(asSupervisor)
  const projectId = searchParams.get('projectId') ?? ''

  const visibleTabs = asSupervisor
    ? TABS.filter(
        (t) =>
          t.id === 'schedule' ||
          t.id === 'weight-deduction' ||
          t.id === 'gantt' ||
          t.id === 'dependencies' ||
          t.id === 'prepared'
      )
    : TABS

  const activeTab = visibleTabs.some((t) => t.id === workshopTab)
    ? workshopTab
    : visibleTabs[0]?.id ?? 'schedule'

  useEffect(() => {
    if (!projectId) return
    void fetch(`/api/workshop/capabilities?projectId=${projectId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.readOnly === 'boolean') {
          setReadOnly(asSupervisor || data.readOnly)
        }
      })
      .catch(() => setReadOnly(asSupervisor))
  }, [projectId, asSupervisor])

  function goTab(tab: WorkshopTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', 'schedule')
    params.set('workshopTab', tab)
    if (projectId) params.set('projectId', projectId)
    if (asSupervisor) params.set('as', 'supervisor')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-3 w-full max-w-full min-w-0" dir="rtl" lang="fa">
      <p className="text-sm text-slate-600 leading-relaxed">
        {readOnly
          ? WORKSHOP_COPY.ops.readOnlyHint
          : WORKSHOP_COPY.ops.editHint}
      </p>

      <nav className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        {visibleTabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => goTab(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('workshop-refresh'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {WORKSHOP_COPY.ops.refresh}
        </button>
      </nav>

      {/* Keep schedule, weight deduction, and gantt mounted so sync updates the hidden view */}
      <div
        className={activeTab === 'schedule' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'schedule'}
      >
        <ScheduleWorkspace showBanner={!embeddedInTechnicalOffice} />
      </div>
      <div
        className={activeTab === 'weight-deduction' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'weight-deduction'}
      >
        <WeightDeductionWorkspace showBanner={!embeddedInTechnicalOffice} />
      </div>
      <div
        className={activeTab === 'gantt' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'gantt'}
      >
        <ScheduleGanttWorkspace />
      </div>
      <div
        className={activeTab === 'dependencies' ? 'block' : 'hidden'}
        aria-hidden={activeTab !== 'dependencies'}
      >
        <DependencyNetworkWorkspace />
      </div>
      {activeTab === 'approvals' && !asSupervisor ? (
        <ApprovalsWorkspace showBanner={!embeddedInTechnicalOffice} />
      ) : null}
      {activeTab === 'prepared' ? (
        <PreparedWorkspace showBanner={!embeddedInTechnicalOffice} />
      ) : null}
    </div>
  )
}
