'use client'

import { MessageSquare } from 'lucide-react'
import { SectionCard } from '@/components/admin/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CriticalBadge } from '@/components/schedule/task-status-badge'
import { ReadinessDots } from '@/components/supervisor/traffic-light'
import type { TodayActivity } from '@/lib/supervisor/types'
import type { SiteSupervisorMessages } from '@/lib/i18n/site-supervisor'
import { cn } from '@/lib/utils'

interface TodayActivitiesTableProps {
  activities: TodayActivity[]
  labels: SiteSupervisorMessages
  isRtl?: boolean
  onOpenQuickReport: (activityId: string) => void
  onCreateInstruction: (activityId: string) => void
}

const plannedLabelsFa: Record<TodayActivity['planned_status'], string> = {
  shouldStart: 'شروع',
  shouldContinue: 'ادامه',
  shouldFinish: 'پایان',
}

const plannedLabelsEn: Record<TodayActivity['planned_status'], string> = {
  shouldStart: 'Start',
  shouldContinue: 'Continue',
  shouldFinish: 'Finish',
}

export function TodayActivitiesTable({
  activities,
  labels,
  isRtl,
  onOpenQuickReport,
  onCreateInstruction,
}: TodayActivitiesTableProps) {
  const plannedLabels = isRtl ? plannedLabelsFa : plannedLabelsEn

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
              <th className="px-4 py-2 font-medium text-start">{isRtl ? 'فعالیت' : 'Activity'}</th>
              <th className="px-4 py-2 font-medium text-start hidden md:table-cell">{isRtl ? 'برنامه' : 'Plan'}</th>
              <th className="px-4 py-2 font-medium text-start">{isRtl ? 'پیشرفت' : 'Progress'}</th>
              <th className="px-4 py-2 font-medium text-start hidden lg:table-cell">{isRtl ? 'آمادگی' : 'Readiness'}</th>
              <th className="px-4 py-2 font-medium text-end">{isRtl ? 'اقدامات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {activities.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{a.wbs_code}</td>
                <td className="px-4 py-3 min-w-[160px]">
                  <div className="font-medium leading-snug">{a.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.is_critical ? <CriticalBadge /> : null}
                    {a.subcontractor_name ? (
                      <Badge variant="outline" className="text-xs">
                        {a.subcontractor_name}
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Badge variant="secondary">{plannedLabels[a.planned_status]}</Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-semibold">{a.actual_progress_percent}%</span>
                  <span className="text-muted-foreground text-xs ms-1">({a.actual_status})</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <ReadinessDots
                    readiness={a.readiness}
                    labels={{ materials: labels.materials, manpower: labels.manpower, access: labels.access }}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenQuickReport(a.id)}>
                      {labels.quickReport}
                    </Button>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
