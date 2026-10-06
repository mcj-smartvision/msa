import type { ComponentType } from 'react'
import type { WidgetRenderContext } from '@/shared/types/dashboard'
import { OverviewStatsWidget } from '@/features/dashboard/components/widgets/overview-stats-widget'
import { ProgressWidget } from '@/features/dashboard/components/widgets/progress-widget'
import { InventoryWidget } from '@/features/dashboard/components/widgets/inventory-widget'
import { ReportWidget } from '@/features/dashboard/components/widgets/report-widget'
import { DailyReportWidget } from '@/features/dashboard/components/widgets/daily-report-widget'
import { SecurityAlertsWidget } from '@/features/dashboard/components/widgets/security-alerts-widget'
import { EntryExitWidget } from '@/features/dashboard/components/widgets/entry-exit-widget'
import { ScheduleWidget } from '@/features/dashboard/components/widgets/schedule-widget'
import { SafetyWidget } from '@/features/dashboard/components/widgets/safety-widget'
import { FinancialWidget } from '@/features/dashboard/components/widgets/financial-widget'

export interface DashboardWidgetDefinition {
  key: string
  title: string
  description: string
  component: ComponentType<{ context: WidgetRenderContext }>
  colSpan?: 1 | 2
}

export const WIDGET_REGISTRY: Record<string, DashboardWidgetDefinition> = {
  'overview.stats': {
    key: 'overview.stats',
    title: 'Overview',
    description: 'High-level project statistics',
    component: OverviewStatsWidget,
  },
  'progress.overview': {
    key: 'progress.overview',
    title: 'Progress',
    description: 'Planned vs actual progress',
    component: ProgressWidget,
    colSpan: 2,
  },
  'inventory.stock': {
    key: 'inventory.stock',
    title: 'Inventory',
    description: 'Stock and materials',
    component: InventoryWidget,
  },
  'reports.recent': {
    key: 'reports.recent',
    title: 'Recent Reports',
    description: 'Latest submitted reports',
    component: ReportWidget,
  },
  'reports.daily': {
    key: 'reports.daily',
    title: 'Daily Report',
    description: 'Submit a daily site report',
    component: DailyReportWidget,
    colSpan: 2,
  },
  'reports.upload': {
    key: 'reports.upload',
    title: 'Daily Report',
    description: 'Submit a daily site report',
    component: DailyReportWidget,
    colSpan: 2,
  },
  'security.alerts': {
    key: 'security.alerts',
    title: 'Security Alerts',
    description: 'Recent security notifications',
    component: SecurityAlertsWidget,
  },
  'security.entry_exit': {
    key: 'security.entry_exit',
    title: 'Entry / Exit',
    description: 'Gate activity log',
    component: EntryExitWidget,
  },
  'schedule.overview': {
    key: 'schedule.overview',
    title: 'Schedule',
    description: 'Upcoming milestones',
    component: ScheduleWidget,
  },
  'safety.overview': {
    key: 'safety.overview',
    title: 'Safety',
    description: 'HSE overview',
    component: SafetyWidget,
  },
  'financial.overview': {
    key: 'financial.overview',
    title: 'Financial',
    description: 'Cost and contract summary',
    component: FinancialWidget,
    colSpan: 2,
  },
}

export function getWidgetDefinition(key: string): DashboardWidgetDefinition | null {
  return WIDGET_REGISTRY[key] ?? null
}
