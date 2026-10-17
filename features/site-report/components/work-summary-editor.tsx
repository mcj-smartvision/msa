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

function parseOngoingLine(line: string): {
  activity: string
  cumulative_percent: number | null
} {
  const pipe = line.indexOf('|')
  if (pipe < 0) return { activity: line, cumulative_percent: null }
  const activity = line.slice(0, pipe)
  const pctRaw = line.slice(pipe + 1).trim()
  const n = pctRaw === '' ? null : Number(pctRaw)
  return {
    activity,
    cumulative_percent: n != null && Number.isFinite(n) ? n : null,
  }
}

function parseUnexecutedLine(line: string): { task: string; reason: string } {
  const pipe = line.indexOf('|')
  if (pipe < 0) return { task: line, reason: '' }
  return { task: line.slice(0, pipe), reason: line.slice(pipe + 1) }
}

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
              a.cumulative_percent != null ? `${a.activity}| ${a.cumulative_percent}` : a.activity
            )
          )}
          onChange={(e) =>
            onChange({
              ...value,
              ongoing_activities: textToLines(e.target.value).map(parseOngoingLine),
            })
          }
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.workUnexecuted}</Label>
        <Textarea
          rows={2}
          value={linesToText(
            value.unexecuted_planned_tasks.map((t) =>
              t.reason ? `${t.task}|${t.reason}` : t.task
            )
          )}
          onChange={(e) =>
            onChange({
              ...value,
              unexecuted_planned_tasks: textToLines(e.target.value).map(parseUnexecutedLine),
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
