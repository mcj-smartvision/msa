/**
 * @file features/dashboard/components/widgets/progress-widget.tsx
 * @purpose ویجت پیشرفت برنامه‌ای/واقعی در داشبورد نقش
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها
 * @depends-on features/dashboard/config.ts, shared/types/dashboard
 */

'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Progress } from '@/shared/components/ui/progress'
import { PROGRESS_WIDGET_COPY } from '@/features/dashboard/config'

export function ProgressWidget({ context }: { context: WidgetRenderContext }) {
  const copy = PROGRESS_WIDGET_COPY
  const planned = copy.sample.planned
  const actual = copy.sample.actual
  const spi = actual / planned

  return (
    <WidgetShell
      title={copy.title}
      description={context.projectId ? copy.description : copy.assignProject}
    >
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>{copy.planned}</span>
            <span>{planned}%</span>
          </div>
          <Progress value={planned} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>{copy.actual}</span>
            <span>{actual}%</span>
          </div>
          <Progress value={actual} className="h-2" />
        </div>
        <div className="flex gap-4 text-sm">
          <Metric label="SPI" value={spi.toFixed(2)} tone={spi >= 1 ? 'good' : 'warn'} />
          <Metric label={copy.delay} value={copy.sample.delay} tone="warn" />
          <Metric label={copy.forecast} value={copy.sample.forecast} />
        </div>
      </div>
    </WidgetShell>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'good' ? 'font-semibold text-emerald-600' : tone === 'warn' ? 'font-semibold text-amber-600' : 'font-semibold'
        }
      >
        {value}
      </p>
    </div>
  )
}
