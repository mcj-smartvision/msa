/**
 * @file features/site-report/components/equipment-editor.tsx
 * @purpose ویرایش دستی ماشین‌آلات
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { emptyEquipmentRow } from '@/features/site-report/lib/empty-rows'
import { parseNum } from '@/features/site-report/lib/lines'
import type { EquipmentOwnershipFa, SiteReportEquipmentRow } from '@/features/site-report/lib/types'

export function EquipmentEditor({
  rows,
  onChange,
}: {
  rows: SiteReportEquipmentRow[]
  onChange: (rows: SiteReportEquipmentRow[]) => void
}) {
  function patch(idx: number, next: SiteReportEquipmentRow) {
    onChange(rows.map((r, i) => (i === idx ? next : r)))
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded-md border border-slate-200 p-2">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-rose-700"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            >
              {SITE_REPORT_COPY.removeRow}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipName}</Label>
              <Input
                value={row.name_or_code}
                onChange={(e) => patch(idx, { ...row, name_or_code: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipOwnership}</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={row.ownership}
                onChange={(e) =>
                  patch(idx, { ...row, ownership: e.target.value as EquipmentOwnershipFa })
                }
              >
                <option value="ملکی">ملکی</option>
                <option value="اجاره‌ای">اجاره‌ای</option>
              </select>
            </div>
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipOperator}</Label>
              <Input
                value={row.operator_name ?? ''}
                onChange={(e) => patch(idx, { ...row, operator_name: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipHours}</Label>
              <Input
                type="number"
                dir="ltr"
                value={row.operating_hours ?? ''}
                onChange={(e) => patch(idx, { ...row, operating_hours: parseNum(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipIdle}</Label>
              <Input
                type="number"
                dir="ltr"
                value={row.idle_hours ?? ''}
                onChange={(e) => patch(idx, { ...row, idle_hours: parseNum(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-[11px]">{SITE_REPORT_COPY.equipBreakdown}</Label>
              <Input
                type="number"
                dir="ltr"
                value={row.breakdown_hours ?? ''}
                onChange={(e) => patch(idx, { ...row, breakdown_hours: parseNum(e.target.value) })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, emptyEquipmentRow()])}
      >
        {SITE_REPORT_COPY.addEquipmentRow}
      </Button>
    </div>
  )
}
