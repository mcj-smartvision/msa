/**
 * @file features/supervisor/components/today-activities-table.tsx
 * @purpose کامپوننت UI — سرپرست کارگاه و گزارش روزانه (today-activities-table)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on features/admin/components/shared, shared/components/ui/button, shared/components/ui/badge, features/schedule/components/task-status-badge, features/supervisor/components/traffic-light, features/supervisor/lib/types, shared/lib/i18n/site-supervisor, features/workshop/components/uom-display, shared/lib/utils
 */

'use client'

import { MessageSquare } from 'lucide-react'
import { SectionCard } from '@/features/admin/components/shared'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { CriticalBadge } from '@/features/schedule/components/task-status-badge'
import { ReadinessDots } from '@/features/supervisor/components/traffic-light'
import type { TodayActivity } from '@/features/supervisor/lib/types'
import type { SiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'
import { QtyWithUom } from '@/features/workshop/components/uom-display'
import { cn } from '@/shared/lib/utils'

interface TodayActivitiesTableProps {
  activities: TodayActivity[]
  labels: SiteSupervisorMessages
  isRtl?: boolean
  onOpenQuickReport: (activityId: string) => void
  onOpenPackageProgress: (activityId: string) => void
  onCreateInstruction: (activityId: string) => void
}

function plannedLabelsOf(labels: SiteSupervisorMessages) {
  return {
    shouldStart: labels.plannedStart,
    shouldContinue: labels.plannedContinue,
    shouldFinish: labels.plannedFinish,
  } as Record<TodayActivity['planned_status'], string>
}

function approvalLabelsOf(labels: SiteSupervisorMessages): Record<string, string> {
  return {
    draft: labels.approvalDraft,
    pending_approval: labels.approvalPending,
    approved: labels.approvalApproved,
    rejected: labels.approvalRejected,
    change_requested: labels.approvalChangeRequested,
  }
}

export function TodayActivitiesTable({
  activities,
  labels,
  isRtl,
  onOpenQuickReport,
  onOpenPackageProgress,
  onCreateInstruction,
}: TodayActivitiesTableProps) {
  const plannedLabels = plannedLabelsOf(labels)
  const approvalLabels = approvalLabelsOf(labels)

  if (activities.length === 0) {
    return (
      <SectionCard title={labels.todayOps}>
        <p className="text-sm text-muted-foreground py-6 text-center">{labels.noActivities}</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title={labels.todayOps}>
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className={cn('w-full text-sm', isRtl && 'text-right')}>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-4 py-2 font-medium text-start">{labels.wbs}</th>
              <th className="px-4 py-2 font-medium text-start">{labels.activity}</th>
              <th className="px-4 py-2 font-medium text-start hidden md:table-cell">
                {labels.plan}
              </th>
              <th className="px-4 py-2 font-medium text-start">{labels.progress}</th>
              <th className="px-4 py-2 font-medium text-start hidden lg:table-cell">
                {labels.readiness}
              </th>
              <th className="px-4 py-2 font-medium text-end">{labels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {activities.map((a) => {
              const isPackage = a.kind === 'package'
              const indent = (a.depth ?? 0) * 14
              return (
                <tr
                  key={a.id}
                  className={cn(
                    'hover:bg-muted/30',
                    isPackage && 'bg-emerald-50/40 hover:bg-emerald-50/60'
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {isPackage ? '↳' : a.wbs_code}
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <div
                      className="font-medium leading-snug"
                      style={{ paddingInlineStart: indent > 0 ? indent : undefined }}
                    >
                      {a.name}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1" style={{ paddingInlineStart: indent > 0 ? indent : undefined }}>
                      {isPackage ? (
                        <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-800">
                          {labels.subBranch}
                        </Badge>
                      ) : null}
                      {!isPackage && a.is_critical ? <CriticalBadge /> : null}
                      {isPackage && a.approvalStatus ? (
                        <Badge variant="secondary" className="text-xs">
                          {isRtl
                            ? approvalLabels[a.approvalStatus] ?? a.approvalStatus
                            : a.approvalStatus}
                        </Badge>
                      ) : null}
                      {a.subcontractor_name ? (
                        <Badge variant="outline" className="text-xs">
                          {a.subcontractor_name}
                        </Badge>
                      ) : null}
                      {isPackage && a.location ? (
                        <span className="text-xs text-muted-foreground">{a.location}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {isPackage ? (
                      <span className="text-xs text-muted-foreground">
                        {a.plannedQtyToday != null ? (
                          <span className="inline-flex items-center gap-1">
                            {labels.plannedToday}:{' '}
                            <QtyWithUom qty={a.plannedQtyToday} uom={a.uom} />
                          </span>
                        ) : (
                          '—'
                        )}
                      </span>
                    ) : (
                      <Badge variant="secondary">{plannedLabels[a.planned_status]}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold">{a.actual_progress_percent}%</span>
                    {isPackage && a.quantity != null ? (
                      <span className="text-muted-foreground text-xs ms-1">
                        (<QtyWithUom qty={a.quantity} uom={a.uom} />)
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs ms-1">({a.actual_status})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {isPackage ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <ReadinessDots
                        readiness={a.readiness}
                        labels={{
                          materials: labels.materials,
                          manpower: labels.manpower,
                          access: labels.access,
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isPackage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenPackageProgress(a.id)}
                        >
                          {labels.saveProgress}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenQuickReport(a.id)}
                        >
                          {labels.quickReport}
                        </Button>
                      )}
                      {!isPackage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title={labels.aiInstruction}
                          aria-label={labels.aiInstruction}
                          onClick={() => onCreateInstruction(a.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
