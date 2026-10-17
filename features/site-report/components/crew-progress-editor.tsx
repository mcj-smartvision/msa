/**
 * @file features/site-report/components/crew-progress-editor.tsx
 * @purpose ویرایش دستی اکیپ‌ها و کار انجام‌شده
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import { emptyCrewRow } from '@/features/site-report/lib/empty-rows'
import { parseNum } from '@/features/site-report/lib/lines'
import type { ActivityStatusFa, SiteReportCrewRow } from '@/features/site-report/lib/types'
import { cn } from '@/shared/lib/utils'

const STATUS_OPTIONS: ActivityStatusFa[] = ['شروع شد', 'در حال انجام', 'تمام شد', 'متوقف']

export function CrewProgressEditor({
  rows,
  onChange,
}: {
  rows: SiteReportCrewRow[]
  onChange: (rows: SiteReportCrewRow[]) => void
}) {
  function patch(idx: number, next: SiteReportCrewRow) {
    onChange(rows.map((r, i) => (i === idx ? next : r)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{SITE_REPORT_COPY.emptyCrewHint}</p>
      ) : null}
      {rows.map((row, idx) => (
        <div
          key={idx}
          className={cn(
            'space-y-2 rounded-md border p-2',
            row.requires_completion ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700">
              {SITE_REPORT_COPY.crewRowLabel} {idx + 1}
              {row.requires_completion ? (
                <span className="mr-2 text-amber-800"> · {SITE_REPORT_COPY.needsCompletion}</span>
              ) : null}
            </span>
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
            <Field label={SITE_REPORT_COPY.crewActivity}>
              <Input
                value={row.activity_name}
                onChange={(e) => patch(idx, { ...row, activity_name: e.target.value })}
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewContractor}>
              <Input
                value={row.contractor_or_crew}
                onChange={(e) => patch(idx, { ...row, contractor_or_crew: e.target.value })}
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewTrade}>
              <Input value={row.trade} onChange={(e) => patch(idx, { ...row, trade: e.target.value })} />
            </Field>
            <Field label={SITE_REPORT_COPY.crewStatus}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={row.activity_status}
                onChange={(e) =>
                  patch(idx, { ...row, activity_status: e.target.value as ActivityStatusFa })
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={SITE_REPORT_COPY.crewFloor}>
              <Input
                value={row.location.floor ?? ''}
                onChange={(e) =>
                  patch(idx, {
                    ...row,
                    location: { ...row.location, floor: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewZone}>
              <Input
                value={row.location.zone ?? ''}
                onChange={(e) =>
                  patch(idx, {
                    ...row,
                    location: { ...row.location, zone: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewHeadcount}>
              <Input
                type="number"
                dir="ltr"
                value={row.headcount ?? ''}
                onChange={(e) => patch(idx, { ...row, headcount: parseNum(e.target.value) })}
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewHours}>
              <Input
                type="number"
                dir="ltr"
                value={row.regular_hours ?? ''}
                onChange={(e) => patch(idx, { ...row, regular_hours: parseNum(e.target.value) })}
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewQty}>
              <Input
                type="number"
                dir="ltr"
                value={row.work_done_today.quantity ?? ''}
                onChange={(e) =>
                  patch(idx, {
                    ...row,
                    work_done_today: {
                      ...row.work_done_today,
                      quantity: parseNum(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label={SITE_REPORT_COPY.crewUnit}>
              <Input
                value={row.work_done_today.unit ?? ''}
                onChange={(e) =>
                  patch(idx, {
                    ...row,
                    work_done_today: {
                      ...row.work_done_today,
                      unit: e.target.value || null,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptyCrewRow()])}>
        {SITE_REPORT_COPY.addCrewRow}
      </Button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  )
}
