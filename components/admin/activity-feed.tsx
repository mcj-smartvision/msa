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
    <div className="relative ms-2 space-y-0">
      <div className="absolute top-2 bottom-2 start-[15px] w-px bg-slate-200" aria-hidden />
      {activities.map((item) => {
        const Icon = typeIcons[item.type]
        return (
          <div key={item.id} className="relative flex items-start gap-3 py-2.5">
            <div
              className={cn(
                'relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white',
                typeColors[item.type]
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-medium text-[13px] text-slate-900">{item.user}</span>
                <span className="text-[11px] text-muted-foreground">{item.role}</span>
                <span className="ms-auto text-[11px] text-muted-foreground">{item.time}</span>
              </div>
              <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">{item.action}</p>
              <span className="mt-1 inline-flex text-[10px] rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                {item.section}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
