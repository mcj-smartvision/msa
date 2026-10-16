/**
 * @file features/dashboard/components/widgets/financial-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (financial-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/types/dashboard, features/dashboard/components/widgets/widget-shell, shared/components/ui/progress
 */

'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Progress } from '@/shared/components/ui/progress'
import { FINANCIAL_WIDGET_COPY } from '@/features/dashboard/config'

export function FinancialWidget({ context }: { context: WidgetRenderContext }) {
  const copy = FINANCIAL_WIDGET_COPY
  const budgetUsed = copy.sample.budgetUsed

  return (
    <WidgetShell title={copy.title} description={copy.description}>
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">{copy.noProject}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{copy.contract}</p>
              <p className="font-semibold">{copy.sample.contract}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{copy.approved}</p>
              <p className="font-semibold">{copy.sample.approved}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{copy.eac}</p>
              <p className="font-semibold">{copy.sample.eac}</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{copy.budgetUsed}</span>
              <span>{budgetUsed}%</span>
            </div>
            <Progress value={budgetUsed} className="h-2" />
          </div>
        </div>
      )}
    </WidgetShell>
  )
}
