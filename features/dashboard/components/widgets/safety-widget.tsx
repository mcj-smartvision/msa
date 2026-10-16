/**
 * @file features/dashboard/components/widgets/safety-widget.tsx
 * @purpose ویجت ایمنی در داشبورد نقش
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها
 * @depends-on features/dashboard/config.ts, shared/types/dashboard
 */

'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { SAFETY_WIDGET_COPY } from '@/features/dashboard/config'

export function SafetyWidget({ context }: { context: WidgetRenderContext }) {
  const copy = SAFETY_WIDGET_COPY
  return (
    <WidgetShell title={copy.title} description={copy.description}>
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">{copy.noProject}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SafetyStat label={copy.labels.daysWithoutStoppage} value={copy.sample.daysWithoutStoppage} good />
          <SafetyStat label={copy.labels.openObservations} value={copy.sample.openObservations} />
          <SafetyStat label={copy.labels.ppeCompliance} value={copy.sample.ppeCompliance} good />
          <SafetyStat label={copy.labels.toolboxTalks} value={copy.sample.toolboxTalks} good />
        </div>
      )}
    </WidgetShell>
  )
}

function SafetyStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${good ? 'text-emerald-600' : ''}`}>{value}</p>
    </div>
  )
}
