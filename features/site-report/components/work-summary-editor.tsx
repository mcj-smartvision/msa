/**
 * @file features/site-report/components/work-summary-editor.tsx
 * @purpose ویرایش دستی خلاصه کارها (هر خط یک مورد)
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { linesToText, textToLines } from '@/features/site-report/lib/lines'
import type { SiteReportWorkSummary } from '@/features/site-report/lib/types'

export function WorkSummaryEditor({
  value,
  onChange,
}: {
  value: SiteReportWorkSummary
  onChange: (next: SiteReportWorkSummary) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.workCompleted}</Label>
        <Textarea
          rows={2}
          value={linesToText(value.completed_activities)}
          onChange={(e) =>
            onChange({ ...value, completed_activities: textToLines(e.target.value) })
          }
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.workOngoing}</Label>
        <Textarea
          rows={2}
          value={linesToText(
            value.ongoing_activities.map((a) =>
              a.cumulative_percent != null ? `${a.activity} | ${a.cumulative_percent}` : a.activity
            )
          )}
          onChange={(e) =>
            onChange({
              ...value,
              ongoing_activities: textToLines(e.target.value).map((line) => {
                const [activity, pct] = line.split('|').map((s) => s.trim())
                const n = pct != null && pct !== '' ? Number(pct) : null
                return {
                  activity,
                  cumulative_percent: n != null && Number.isFinite(n) ? n : null,
                }
              }),
            })
          }
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.workUnexecuted}</Label>
        <Textarea
          rows={2}
          value={linesToText(
            value.unexecuted_planned_tasks.map((t) => `${t.task} | ${t.reason}`)
          )}
          onChange={(e) =>
            onChange({
              ...value,
              unexecuted_planned_tasks: textToLines(e.target.value).map((line) => {
                const [task, ...rest] = line.split('|').map((s) => s.trim())
                return { task, reason: rest.join(' | ') || '' }
              }),
            })
          }
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.workOutOfPlan}</Label>
        <Textarea
          rows={2}
          value={linesToText(value.out_of_plan_tasks)}
          onChange={(e) => onChange({ ...value, out_of_plan_tasks: textToLines(e.target.value) })}
        />
      </div>
    </div>
  )
}
