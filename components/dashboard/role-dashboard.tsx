'use client'

import { useMemo } from 'react'
import { getWidgetDefinition } from '@/lib/dashboard/widget-registry'
import { SITE_ROLE_LABELS } from '@/lib/dashboard/roles'
import type { WidgetRenderContext } from '@/types/dashboard'
import { WidgetGrid, WidgetGridItem } from '@/components/widgets/widget-shell'
import { PageHeader } from '@/components/admin/shared'

interface RoleDashboardProps {
  context: WidgetRenderContext
  widgetKeys: string[]
}

export function RoleDashboard({ context, widgetKeys }: RoleDashboardProps) {
  const widgets = useMemo(
    () =>
      widgetKeys
        .map((key) => getWidgetDefinition(key))
        .filter((def): def is NonNullable<typeof def> => Boolean(def)),
    [widgetKeys]
  )

  const roleLabel = context.user.primaryRole
    ? SITE_ROLE_LABELS[context.user.primaryRole]
    : 'عضو تیم'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`داشبورد ${roleLabel}`}
        description={`${context.user.fullName} عزیز، خوش آمدید. فضای کاری مطابق نقش شما تنظیم شده است.`}
      />

      {widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">ویجتی برای نقش شما پیکربندی نشده است.</p>
      ) : (
        <WidgetGrid>
          {widgets.map((widget) => {
            const Component = widget.component
            return (
              <WidgetGridItem key={widget.key} colSpan={widget.colSpan}>
                <Component context={context} />
              </WidgetGridItem>
            )
          })}
        </WidgetGrid>
      )}
    </div>
  )
}
