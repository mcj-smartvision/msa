/**
 * @file features/dashboard/components/widgets/inventory-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (inventory-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/types/dashboard, features/dashboard/components/widgets/widget-shell, shared/components/ui/button
 */

'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Button } from '@/shared/components/ui/button'
import { INVENTORY_WIDGET_COPY } from '@/features/dashboard/config'

export function InventoryWidget({ context }: { context: WidgetRenderContext }) {
  const copy = INVENTORY_WIDGET_COPY
  return (
    <WidgetShell
      title={copy.title}
      description={copy.description}
      action={<Button size="sm" variant="outline">{copy.receive}</Button>}
    >
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">{copy.noProject}</p>
      ) : (
        <ul className="space-y-2">
          {copy.sampleStock.map((row) => (
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
  const copy = INVENTORY_WIDGET_COPY.status
  const tone =
    status === copy.critical ? 'bg-red-100 text-red-800' :
    status === copy.low ? 'bg-amber-100 text-amber-800' :
    'bg-emerald-100 text-emerald-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
}
