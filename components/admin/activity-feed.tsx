'use client'

import type { AdminActivityItem } from '@/types/admin'
import { cn } from '@/lib/utils'

const typeColors = {
  action: 'bg-sky-600 text-white',
  alert: 'bg-amber-600 text-white',
  security: 'bg-red-600 text-white',
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function ActivityFeed({ activities }: { activities: AdminActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        هنوز فعالیتی ثبت نشده — گزارش روزانه، گیت، صورت‌وضعیت و پیام‌ها اینجا می‌آیند.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {activities.map((item) => (
        <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
          <span
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
              typeColors[item.type]
            )}
            aria-hidden
          >
            {initialOf(item.user)}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium text-[13px] text-slate-900">{item.user}</span>
              <span className="text-[11px] text-slate-500">{item.role}</span>
              <span className="ms-auto text-[11px] text-sky-700 tabular-nums">{item.time}</span>
            </div>
            <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">{item.action}</p>
            <span className="mt-1 inline-flex text-[10px] rounded-md bg-sky-50 px-1.5 py-0.5 font-medium text-sky-800">
              {item.section}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
