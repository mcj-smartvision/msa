/**
 * @file features/site-report/components/hse-special-editor.tsx
 * @purpose ویرایش دستی HSE و موارد خاص پروژه
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { linesToText, parseNum, textToLines } from '@/features/site-report/lib/lines'
import type { SiteReportHse, SiteReportSpecialItems } from '@/features/site-report/lib/types'

export function HseEditor({
  value,
  onChange,
}: {
  value: SiteReportHse
  onChange: (next: SiteReportHse) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.hseAccidents}</Label>
        <Textarea
          rows={2}
          value={linesToText(value.accidents)}
          onChange={(e) => onChange({ ...value, accidents: textToLines(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.hseNearMiss}</Label>
        <Textarea
          rows={2}
          value={linesToText(value.near_misses)}
          onChange={(e) => onChange({ ...value, near_misses: textToLines(e.target.value) })}
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.hseWarnings}</Label>
        <Textarea
          rows={2}
          value={linesToText(value.safety_warnings)}
          onChange={(e) => onChange({ ...value, safety_warnings: textToLines(e.target.value) })}
        />
      </div>
      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={value.toolbox_talk.held}
          onChange={(e) =>
            onChange({
              ...value,
              toolbox_talk: { ...value.toolbox_talk, held: e.target.checked },
            })
          }
        />
        {SITE_REPORT_COPY.hseToolbox}
      </label>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.hseToolboxTopic}</Label>
        <Input
          value={value.toolbox_talk.topic ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              toolbox_talk: { ...value.toolbox_talk, topic: e.target.value || null },
            })
          }
        />
      </div>
      <div>
        <Label className="text-[11px]">{SITE_REPORT_COPY.hseAttendees}</Label>
        <Input
          type="number"
          dir="ltr"
          value={value.toolbox_talk.attendees_count ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              toolbox_talk: {
                ...value.toolbox_talk,
                attendees_count: parseNum(e.target.value),
              },
            })
          }
        />
      </div>
      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={value.work_stopped_by_hse}
          onChange={(e) => onChange({ ...value, work_stopped_by_hse: e.target.checked })}
        />
        {SITE_REPORT_COPY.hseStopped}
      </label>
    </div>
  )
}

export function SpecialItemsEditor({
  value,
  onChange,
}: {
  value: SiteReportSpecialItems
  onChange: (next: SiteReportSpecialItems) => void
}) {
  const fields = [
    ['geotechnical_monitoring', SITE_REPORT_COPY.specialGeo],
    ['neighbor_issues', SITE_REPORT_COPY.specialNeighbor],
    ['municipal_and_utility_permits', SITE_REPORT_COPY.specialPermits],
    ['rfis_and_design_changes', SITE_REPORT_COPY.specialRfi],
    ['subcontractor_entries_exits', SITE_REPORT_COPY.specialSub],
  ] as const

  return (
    <div className="space-y-2">
      {fields.map(([key, label]) => (
        <div key={key}>
          <Label className="text-[11px]">{label}</Label>
          <Input
            value={value[key] ?? ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value || null })}
          />
        </div>
      ))}
    </div>
  )
}
