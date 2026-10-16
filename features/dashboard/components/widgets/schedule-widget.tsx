/**
 * @file features/dashboard/components/widgets/schedule-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (schedule-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/types/dashboard, features/dashboard/components/widgets/widget-shell
 */

'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { SCHEDULE_WIDGET_COPY } from '@/features/dashboard/config'

export function ScheduleWidget({ context }: { context: WidgetRenderContext }) {
  const copy = SCHEDULE_WIDGET_COPY
  return (
    <WidgetShell title={copy.title} description={copy.description}>
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">{copy.needBaseline}</p>
      ) : (
        <ul className="space-y-2">
          {copy.sampleMilestones.map((item) => (
            <li key={item.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{item.name}</span>
              <span className="text-muted-foreground">{item.date}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  )
}
