'use client'

import type { AdminActivityItem } from '@/types/admin'
import { Activity, AlertTriangle, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeIcons = {
  action: Activity,
  alert: AlertTriangle,
  security: Shield,
}

const typeColors = {
  action: 'bg-sky-50 text-sky-700',
  alert: 'bg-amber-50 text-amber-700',
  security: 'bg-rose-50 text-rose-700',
}

export function ActivityFeed({ activities }: { activities: AdminActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        هنوز فعالیتی ثبت نشده — گزارش‌ها، رویدادهای گیت و هشدارها اینجا نمایش داده می‌شوند.
      </p>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {activities.map((item) => {
        const Icon = typeIcons[item.type]
        return (
          <div key={item.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
            <div
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                typeColors[item.type]
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium text-sm text-slate-900">{item.user}</span>
                <span className="text-xs text-muted-foreground">{item.role}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.action}</p>
              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-[11px] rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  {item.section}
                </span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
