/**
 * @file features/manager/lib/manager-nav.ts
 * @purpose منطق دامنه — داشبورد مدیر پروژه و KPI (manager-nav)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on shared/types/dashboard, features/schedule/lib/access, features/manager/lib/i18n/nav-copy
 */

import type { DashboardUserContext } from '@/shared/types/dashboard'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getManagerNavCopy } from '@/features/manager/lib/i18n/nav-copy'

export type ManagerNavIcon =
  | 'home'
  | 'alerts'
  | 'inbox'
  | 'schedule'
  | 'site'
  | 'quality'
  | 'finance'
  | 'contracts'
  | 'reports'
  | 'background'
  | 'store'
  | 'estimate'

export interface ManagerNavLink {
  label: string
  href: string
  /** Target page reads `?projectId=` instead of the project cookie. */
  withProjectParam?: boolean
}

export interface ManagerNavGroup {
  key: string
  label: string
  icon: ManagerNavIcon
  href?: string
  withProjectParam?: boolean
  children?: ManagerNavLink[]
}

export interface ManagerNavModel {
  groups: ManagerNavGroup[]
  /** Modules the user cannot open (no page yet, or no access) — explained in the help panel. */
  unavailable: string[]
}

/** Sidebar built only from pages that exist and whose guards this user passes. */
export function buildManagerNav(
  context: DashboardUserContext,
  locale: FormLocale | string = 'fa'
): ManagerNavModel {
  const t = getManagerNavCopy(locale)
  const has = (key: string) => context.isSystemAdmin || context.positionKeys.includes(key)
  const pm = has('project_manager')
  const unavailable: string[] = [t.unavailableMachines, t.unavailableClaims]

  const pick = (
    allowed: boolean,
    link: ManagerNavLink,
    missingLabel: string
  ): ManagerNavLink[] => {
    if (allowed) return [link]
    unavailable.push(t.missingAccess(missingLabel))
    return []
  }

  const schedule = [
    ...pick(
      pm || has('technical_office'),
      { label: t.scheduleIntel, href: '/dashboard/schedule-intelligence' },
      t.missingScheduleIntel
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'project-manager'),
      { label: t.evm, href: '/dashboard/project-manager' },
      t.missingEvm
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'technical-office'),
      { label: t.workshopSchedule, href: '/dashboard/technical-office' },
      t.missingWorkshopSchedule
    ),
  ]

  const site = [
    ...pick(
      hasRoleDashboardAccess(context, 'security'),
      { label: t.hrGate, href: '/dashboard/security' },
      t.missingHrGate
    ),
    ...pick(has('storekeeper'), { label: t.warehouse, href: '/dashboard/storekeeper' }, t.missingWarehouse),
  ]

  const quality = [
    ...pick(
      hasRoleDashboardAccess(context, 'qc'),
      { label: t.qcNcr, href: '/dashboard/qc' },
      t.missingQc
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'hse'),
      { label: t.hseCctv, href: '/dashboard/hse' },
      t.missingHse
    ),
  ]

  const finance = [
    ...pick(
      pm || hasRoleDashboardAccess(context, 'accountant'),
      { label: t.actualCosts, href: '/finance/costs' },
      t.missingActualCosts
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'accountant'),
      { label: t.employerInvoices, href: '/dashboard/accountant' },
      t.missingInvoices
    ),
  ]

  const groups: ManagerNavGroup[] = [
    { key: 'home', label: t.home, icon: 'home', href: '/dashboard/manager' },
    { key: 'alerts', label: t.alerts, icon: 'alerts', href: '/dashboard/manager/alerts' },
    { key: 'estimate', label: t.estimate, icon: 'estimate', href: '/dashboard/manager/estimate' },
  ]

  if (pm) {
    groups.push({
      key: 'inbox',
      label: t.inbox,
      icon: 'inbox',
      href: '/site-ops/approvals',
      withProjectParam: true,
    })
  }
  if (schedule.length) {
    groups.push({ key: 'schedule', label: t.schedule, icon: 'schedule', children: schedule })
  }
  if (site.length) {
    groups.push({ key: 'site', label: t.site, icon: 'site', children: site })
  }
  if (quality.length) {
    groups.push({ key: 'quality', label: t.quality, icon: 'quality', children: quality })
  }
  if (finance.length) {
    groups.push({ key: 'finance', label: t.finance, icon: 'finance', children: finance })
  }
  if (hasRoleDashboardAccess(context, 'project-manager') || has('finance_admin')) {
    groups.push({
      key: 'contracts',
      label: t.contracts,
      icon: 'contracts',
      href: '/project/subcontractors',
    })
  }
  groups.push({ key: 'reports', label: t.reports, icon: 'reports', href: '/reports' })
  groups.push({ key: 'background', label: t.background, icon: 'background', href: '/dashboard/manager/background' })
  groups.push({ key: 'store', label: t.store, icon: 'store', href: '/dashboard/manager/store' })

  return { groups, unavailable }
}
