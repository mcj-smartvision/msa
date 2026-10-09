'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'

const MILESTONES = [
  { name: 'اتمام فونداسیون', date: '12 فروردین', status: 'done' },
  { name: 'بتن‌ریزی سقف طبقه 3', date: '13 اردیبهشت', status: 'active' },
  { name: 'شروع زیرسازی تأسیسات', date: '7 خرداد', status: 'upcoming' },
  { name: 'بستن نما', date: '24 تیر', status: 'upcoming' },
]

export function ScheduleWidget({ context }: { context: WidgetRenderContext }) {
  return (
    <WidgetShell title="برنامه زمان‌بندی" description="نقاط عطف برنامه پایه">
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">برای فعال‌سازی نقاط عطف، برنامه پایه را بارگذاری کنید.</p>
      ) : (
        <ul className="space-y-2">
          {MILESTONES.map((item) => (
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
