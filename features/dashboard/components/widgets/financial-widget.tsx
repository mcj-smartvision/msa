'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Progress } from '@/shared/components/ui/progress'

export function FinancialWidget({ context }: { context: WidgetRenderContext }) {
  const budgetUsed = 58

  return (
    <WidgetShell title="خلاصه مالی" description="عملکرد کلی قرارداد (فقط مشاهده)">
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">پروژه‌ای انتخاب نشده است.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">مبلغ قرارداد</p>
              <p className="font-semibold">$12.4M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تأییدشده تا امروز</p>
              <p className="font-semibold">$7.2M</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">پیش‌بینی در پایان</p>
              <p className="font-semibold">$12.8M</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>بودجه مصرف‌شده</span>
              <span>{budgetUsed}%</span>
            </div>
            <Progress value={budgetUsed} className="h-2" />
          </div>
        </div>
      )}
    </WidgetShell>
  )
}
