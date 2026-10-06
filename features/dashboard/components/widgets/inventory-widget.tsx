'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Button } from '@/shared/components/ui/button'

const SAMPLE_STOCK = [
  { item: 'میلگرد ۱۶', qty: '۲٫۴ تن', status: 'کم' },
  { item: 'سیمان پرتلند', qty: '۱۸۰ پاکت', status: 'کافی' },
  { item: 'پانل قالب', qty: '۴۲ عدد', status: 'کافی' },
  { item: 'هارنس ایمنی', qty: '۶ عدد', status: 'بحرانی' },
]

export function InventoryWidget({ context }: { context: WidgetRenderContext }) {
  return (
    <WidgetShell
      title="موجودی و انبار"
      description="دریافت مصالح و سطح موجودی در سایت"
      action={<Button size="sm" variant="outline">دریافت</Button>}
    >
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">پروژه‌ای انتخاب نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {SAMPLE_STOCK.map((row) => (
            <li key={row.item} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{row.item}</span>
              <span className="text-muted-foreground">{row.qty}</span>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'بحرانی' ? 'bg-red-100 text-red-800' :
    status === 'کم' ? 'bg-amber-100 text-amber-800' :
    'bg-emerald-100 text-emerald-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
}
