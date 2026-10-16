/**
 * @file features/dashboard/components/role-dashboard.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (role-dashboard)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/lib/dashboard/widget-registry, shared/lib/dashboard/roles, shared/types/dashboard, features/dashboard/components/widgets/widget-shell, features/admin/components/shared
 */

'use client'

import { useMemo } from 'react'
import { getWidgetDefinition } from '@/shared/lib/dashboard/widget-registry'
import { SITE_ROLE_LABELS } from '@/shared/lib/dashboard/roles'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetGrid, WidgetGridItem } from '@/features/dashboard/components/widgets/widget-shell'
import { PageHeader } from '@/features/admin/components/shared'
import { ROLE_DASHBOARD_COPY } from '@/features/dashboard/config'

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

  const copy = ROLE_DASHBOARD_COPY
  const roleLabel = context.user.primaryRole
    ? SITE_ROLE_LABELS[context.user.primaryRole]
    : copy.fallbackRole

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${copy.titlePrefix} ${roleLabel}`}
        description={copy.welcome(context.user.fullName)}
      />

      {widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.noWidgets}</p>
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
