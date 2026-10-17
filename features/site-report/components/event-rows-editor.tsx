/**
 * @file features/site-report/components/event-rows-editor.tsx
 * @purpose ویرایش دستی QC / بازدید / تأخیر
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { emptyDelayRow, emptyQcRow, emptyVisitRow } from '@/features/site-report/lib/empty-rows'
import { parseNum } from '@/features/site-report/lib/lines'
import type {
  DelayCauseCategoryFa,
  QcResultFa,
  SiteReportDelayRow,
  SiteReportQcRow,
  SiteReportVisitRow,
} from '@/features/site-report/lib/types'

const QC_RESULTS: QcResultFa[] = ['قبول', 'رد', 'مشروط', 'در انتظار پاسخ']
const DELAY_CAUSES: DelayCauseCategoryFa[] = [
  'آب‌وهوا',
  'تأخیر کارفرما',
  'نقص نقشه یا تغییر طرح',
  'کمبود مصالح',
  'مجوزها و شهرداری',
  'قطعی آب و برق',
  'معارضین و همسایه‌ها',
  'خرابی دستگاه',
  'سایر',
]

export function QcEditor({
  rows,
  onChange,
}: {
  rows: SiteReportQcRow[]
  onChange: (rows: SiteReportQcRow[]) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="grid gap-2 rounded border border-slate-100 p-2 sm:grid-cols-2">
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.qcType}</Label>
            <Input
              value={row.test_type}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === idx ? { ...r, test_type: e.target.value } : r)))
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.qcResult}</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={row.result}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, result: e.target.value as QcResultFa } : r
                  )
                )
              }
            >
              {QC_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-700"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              {SITE_REPORT_COPY.removeRow}
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptyQcRow()])}>
        {SITE_REPORT_COPY.addQcRow}
      </Button>
    </div>
  )
}

export function VisitsEditor({
  rows,
  onChange,
}: {
  rows: SiteReportVisitRow[]
  onChange: (rows: SiteReportVisitRow[]) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-amber-900">{SITE_REPORT_COPY.disclaimerVisits}</p>
      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded border border-slate-100 p-2">
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.visitWho}</Label>
            <Input
              value={row.visitor_name_and_role}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, visitor_name_and_role: e.target.value } : r
                  )
                )
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.visitDirective}</Label>
            <Input
              value={row.directive_or_decision}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, directive_or_decision: e.target.value } : r
                  )
                )
              }
            />
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={row.official_letter_required}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, official_letter_required: e.target.checked } : r
                  )
                )
              }
            />
            {SITE_REPORT_COPY.visitOfficialLetter}
          </label>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-700"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              {SITE_REPORT_COPY.removeRow}
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, emptyVisitRow()])}
      >
        {SITE_REPORT_COPY.addVisitRow}
      </Button>
    </div>
  )
}

export function DelaysEditor({
  rows,
  onChange,
}: {
  rows: SiteReportDelayRow[]
  onChange: (rows: SiteReportDelayRow[]) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="grid gap-2 rounded border border-slate-100 p-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-[11px]">{SITE_REPORT_COPY.delayDesc}</Label>
            <Input
              value={row.description}
              onChange={(e) =>
                onChange(rows.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.delayCause}</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={row.cause_category}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, cause_category: e.target.value as DelayCauseCategoryFa } : r
                  )
                )
              }
            >
              {DELAY_CAUSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[11px]">{SITE_REPORT_COPY.delayHours}</Label>
            <Input
              type="number"
              dir="ltr"
              value={row.lost_hours ?? ''}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === idx ? { ...r, lost_hours: parseNum(e.target.value) } : r
                  )
                )
              }
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-700"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              {SITE_REPORT_COPY.removeRow}
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, emptyDelayRow()])}
      >
        {SITE_REPORT_COPY.addDelayRow}
      </Button>
    </div>
  )
}
