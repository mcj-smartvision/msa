/**
 * @file features/site-report/components/materials-editor.tsx
 * @purpose ویرایش دستی مصالح ورودی / مصرفی / کمبود
 * @safe-to-edit YES
 * @affects فرم گزارش روزانه
 * @depends-on features/site-report/lib/*, shared/components/ui/*
 */

'use client'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SITE_REPORT_COPY } from '@/features/site-report/config'
import {
  emptyMaterialConsumed,
  emptyMaterialReceived,
  emptyMaterialShortage,
} from '@/features/site-report/lib/empty-rows'
import { parseNum } from '@/features/site-report/lib/lines'
import type { SiteReportMaterials } from '@/features/site-report/lib/types'

export function MaterialsEditor({
  value,
  onChange,
}: {
  value: SiteReportMaterials
  onChange: (next: SiteReportMaterials) => void
}) {
  return (
    <div className="space-y-3 text-xs">
      <Block title={SITE_REPORT_COPY.materialsReceived}>
        {value.received.map((m, i) => (
          <div key={i} className="grid gap-2 rounded border border-slate-100 p-2 sm:grid-cols-3">
            <Input
              placeholder={SITE_REPORT_COPY.itemName}
              value={m.item_name}
              onChange={(e) => {
                const received = value.received.map((r, idx) =>
                  idx === i ? { ...r, item_name: e.target.value } : r
                )
                onChange({ ...value, received })
              }}
            />
            <Input
              type="number"
              dir="ltr"
              placeholder={SITE_REPORT_COPY.quantity}
              value={m.quantity ?? ''}
              onChange={(e) => {
                const received = value.received.map((r, idx) =>
                  idx === i ? { ...r, quantity: parseNum(e.target.value) } : r
                )
                onChange({ ...value, received })
              }}
            />
            <div className="flex gap-1">
              <Input
                placeholder={SITE_REPORT_COPY.unit}
                value={m.unit ?? ''}
                onChange={(e) => {
                  const received = value.received.map((r, idx) =>
                    idx === i ? { ...r, unit: e.target.value || null } : r
                  )
                  onChange({ ...value, received })
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-rose-700"
                onClick={() =>
                  onChange({ ...value, received: value.received.filter((_, idx) => idx !== i) })
                }
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
          onClick={() => onChange({ ...value, received: [...value.received, emptyMaterialReceived()] })}
        >
          {SITE_REPORT_COPY.addReceived}
        </Button>
      </Block>

      <Block title={SITE_REPORT_COPY.materialsConsumed}>
        {value.consumed.map((m, i) => (
          <div key={i} className="grid gap-2 rounded border border-slate-100 p-2 sm:grid-cols-3">
            <Input
              placeholder={SITE_REPORT_COPY.itemName}
              value={m.item_name}
              onChange={(e) => {
                const consumed = value.consumed.map((r, idx) =>
                  idx === i ? { ...r, item_name: e.target.value } : r
                )
                onChange({ ...value, consumed })
              }}
            />
            <Input
              type="number"
              dir="ltr"
              placeholder={SITE_REPORT_COPY.quantity}
              value={m.quantity ?? ''}
              onChange={(e) => {
                const consumed = value.consumed.map((r, idx) =>
                  idx === i ? { ...r, quantity: parseNum(e.target.value) } : r
                )
                onChange({ ...value, consumed })
              }}
            />
            <div className="flex gap-1">
              <Input
                placeholder={SITE_REPORT_COPY.unit}
                value={m.unit ?? ''}
                onChange={(e) => {
                  const consumed = value.consumed.map((r, idx) =>
                    idx === i ? { ...r, unit: e.target.value || null } : r
                  )
                  onChange({ ...value, consumed })
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-rose-700"
                onClick={() =>
                  onChange({ ...value, consumed: value.consumed.filter((_, idx) => idx !== i) })
                }
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
          onClick={() => onChange({ ...value, consumed: [...value.consumed, emptyMaterialConsumed()] })}
        >
          {SITE_REPORT_COPY.addConsumed}
        </Button>
      </Block>

      <Block title={SITE_REPORT_COPY.materialsShortages}>
        {value.shortages.map((m, i) => (
          <div key={i} className="grid gap-2 rounded border border-slate-100 p-2 sm:grid-cols-3">
            <Input
              placeholder={SITE_REPORT_COPY.itemName}
              value={m.item_name}
              onChange={(e) => {
                const shortages = value.shortages.map((r, idx) =>
                  idx === i ? { ...r, item_name: e.target.value } : r
                )
                onChange({ ...value, shortages })
              }}
            />
            <Input
              type="number"
              dir="ltr"
              placeholder={SITE_REPORT_COPY.quantity}
              value={m.required_quantity ?? ''}
              onChange={(e) => {
                const shortages = value.shortages.map((r, idx) =>
                  idx === i ? { ...r, required_quantity: parseNum(e.target.value) } : r
                )
                onChange({ ...value, shortages })
              }}
            />
            <div className="flex gap-1">
              <Input
                placeholder={SITE_REPORT_COPY.unit}
                value={m.unit ?? ''}
                onChange={(e) => {
                  const shortages = value.shortages.map((r, idx) =>
                    idx === i ? { ...r, unit: e.target.value || null } : r
                  )
                  onChange({ ...value, shortages })
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-rose-700"
                onClick={() =>
                  onChange({ ...value, shortages: value.shortages.filter((_, idx) => idx !== i) })
                }
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
          onClick={() => onChange({ ...value, shortages: [...value.shortages, emptyMaterialShortage()] })}
        >
          {SITE_REPORT_COPY.addShortage}
        </Button>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  )
}
