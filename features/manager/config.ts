/**
 * @file features/manager/config.ts
 * @purpose برچسب‌ها، آستانه‌های UI و اعداد جادویی داشبورد مدیر پروژه
 * @safe-to-edit YES
 * @affects features/manager/components
 * @depends-on features/manager/lib/ui-copy, features/manager/lib/i18n/shell-copy
 */

import {
  DASHBOARD_CONFIG,
  MANAGER_DAILY_REPORTS_COPY,
  MANAGER_HELP_COPY,
  MANAGER_PUNCT,
  MANAGER_TOUR_COPY,
  MANAGER_TOUR_STEPS,
  MANAGER_UI_COPY,
  PERIOD_REPORT_TITLES,
  PERIOD_WORDS,
} from '@/features/manager/lib/i18n/shell-copy'

export interface ManagerHelpCopyLink {
  label: string
  description: string
  href: string
}

export type { ManagerTourCopyStep } from '@/features/manager/lib/i18n/shell-copy'

export {
  BACKGROUND_COPY,
  CHART_COPY,
  COST_PERF_COPY,
  CUMULATIVE_COPY,
  DAILY_COPY,
  ESTIMATE_COPY,
  FRONTS_COPY,
  INBOX_COPY,
  PERIOD_COPY,
  SECTIONS_COPY,
  WEEKLY_COPY,
  WEEKLY_HELP_COPY,
} from '@/features/manager/lib/ui-copy'

export {
  DASHBOARD_CONFIG,
  MANAGER_DAILY_REPORTS_COPY,
  MANAGER_HELP_COPY,
  MANAGER_PUNCT,
  MANAGER_TOUR_COPY,
  MANAGER_TOUR_STEPS,
  MANAGER_UI_COPY,
  PERIOD_REPORT_TITLES,
  PERIOD_WORDS,
}

/** Display and timing numbers used by manager UI — not formula logic. */
export const MANAGER_UI_NUMBERS = {
  refreshMs: 5 * 60 * 1000,
  visibilityReloadMs: 60_000,
  clockTickMs: 30_000,
  tourCardWidth: 340,
  tourPad: 6,
  tourMeasureDelayMs: 350,
  alertsPreview: 3,
  notificationsPreview: 3,
  blockersPreview: 4,
  inboxToastMs: 8_000,
  frontsToastMs: 10_000,
  chartForwardMonths: 3,
  recentHistoryDays: 45,
  chartOneMonthBackDays: 31,
  chartOneMonthForwardDays: 10,
  fulfillmentGood: 95,
  fulfillmentWarn: 50,
  dailyStaleHours: 24,
  gaugeMax: 1.5,
  helpPanelMaxWidth: 440,
  defaultLoadingRows: 3,
  inboxLoadingRows: 3,
  notificationCap: 99,
} as const

export { MANAGER_DASHBOARD_COPY, getManagerDashboardCopy } from '@/features/manager/lib/i18n/dashboard-copy'

export function buildManagerHelpLinks(hrefs: {
  inbox: (() => string) | null
  evm?: string
  scheduleIntel?: string
  attendance?: string
  inventory?: string
  invoices?: string
}): ManagerHelpCopyLink[] {
  const links = MANAGER_HELP_COPY.links
  const candidates: (ManagerHelpCopyLink | null)[] = [
    { ...links.alerts, href: '/dashboard/manager/alerts' },
    { ...links.background, href: '/dashboard/manager/background' },
    { ...links.store, href: '/dashboard/manager/store' },
    { ...links.estimate, href: '/dashboard/manager/estimate' },
    hrefs.inbox ? { ...links.inbox, href: hrefs.inbox() } : null,
    hrefs.evm ? { ...links.evm, href: hrefs.evm } : null,
    hrefs.scheduleIntel ? { ...links.scheduleIntel, href: hrefs.scheduleIntel } : null,
    hrefs.attendance ? { ...links.attendance, href: hrefs.attendance } : null,
    hrefs.inventory ? { ...links.inventory, href: hrefs.inventory } : null,
    hrefs.invoices ? { ...links.invoices, href: hrefs.invoices } : null,
  ]
  return candidates.filter((c): c is ManagerHelpCopyLink => c != null)
}
