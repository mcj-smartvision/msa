'use client'

import { useMemo } from 'react'
import { getWidgetDefinition } from '@/lib/dashboard/widget-registry'
import { blockCodeForLegacyWidget } from '@/lib/dashboard/ui-block-catalog'
import { SITE_ROLE_LABELS } from '@/lib/dashboard/roles'
import type { WidgetRenderContext } from '@/types/dashboard'
import { WidgetGrid, WidgetGridItem } from '@/components/widgets/widget-shell'
import { PageHeader } from '@/components/admin/shared'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'

interface RoleDashboardProps {
  context: WidgetRenderContext
  widgetKeys: string[]
  visibleBlockCodes?: string[]
  showAdminBlockCodes?: boolean
}

export function RoleDashboard({
  context,
  widgetKeys,
  visibleBlockCodes = [],
  showAdminBlockCodes = false,
}: RoleDashboardProps) {
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
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={showAdminBlockCodes}
      dashboard="general"
      projectId={context.projectId}
    >
      <div className="space-y-6">
        <UiBlockCustomizePanel />

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
              const blockCode = blockCodeForLegacyWidget(widget.key) ?? 'GEN-WGT-01'
              return (
                <WidgetGridItem key={widget.key} colSpan={widget.colSpan}>
                  <UiBlockGuard code={blockCode}>
                    <Component context={context} />
                  </UiBlockGuard>
                </WidgetGridItem>
              )
            })}
          </WidgetGrid>
        )}
      </div>
    </UiBlockVisibilityProvider>
  )
}
