'use client'

import type { WidgetRenderContext } from '@/shared/types/dashboard';
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell';

export function SafetyWidget({ context }: { context: WidgetRenderContext }) {
  return (
    <WidgetShell title="نمای ایمنی" description="وضعیت HSE و مشاهدات باز">
      {!context.projectId ? (
        <p className="text-sm text-muted-foreground">پروژه‌ای انتخاب نشده است.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SafetyStat label="روز بدون حادثه منجر به توقف" value="47" good />
          <SafetyStat label="مشاهدات باز" value="3" />
          <SafetyStat label="رعایت PPE" value="92%" good />
          <SafetyStat label="جلسات ایمنی (هفته)" value="5" good />
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
