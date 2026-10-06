import type { DashboardUserContext } from '@/shared/types/dashboard'
import { hasRoleDashboardAccess } from '@/features/schedule/lib/access'

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
export function buildManagerNav(context: DashboardUserContext): ManagerNavModel {
  const has = (key: string) => context.isSystemAdmin || context.positionKeys.includes(key)
  const pm = has('project_manager')
  const unavailable: string[] = [
    'ماشین‌آلات و تجهیزات (ماژول آن هنوز در سامانه ساخته نشده است)',
    'دعاوی و مکاتبات قراردادی (ماژول آن هنوز در سامانه ساخته نشده است)',
  ]

  const pick = (
    allowed: boolean,
    link: ManagerNavLink,
    missingLabel: string
  ): ManagerNavLink[] => {
    if (allowed) return [link]
    unavailable.push(`${missingLabel} (دسترسی این نقش تعریف نشده است)`)
    return []
  }

  const schedule = [
    ...pick(
      pm || has('technical_office'),
      { label: 'تحلیل زمان‌بندی و مسیر بحرانی', href: '/dashboard/schedule-intelligence' },
      'تحلیل زمان‌بندی'
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'project-manager'),
      { label: 'شاخص‌های ارزش کسب‌شده (EVM)', href: '/dashboard/project-manager' },
      'شاخص‌های EVM'
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'technical-office'),
      { label: 'برنامهٔ زمان‌بندی کارگاه', href: '/dashboard/technical-office' },
      'برنامهٔ زمان‌بندی دفتر فنی'
    ),
  ]

  const site = [
    ...pick(
      hasRoleDashboardAccess(context, 'security'),
      { label: 'منابع انسانی و تردد', href: '/dashboard/security' },
      'منابع انسانی و تردد'
    ),
    ...pick(
      has('storekeeper'),
      { label: 'انبار و مصالح', href: '/dashboard/storekeeper' },
      'انبار و مصالح'
    ),
  ]

  const quality = [
    ...pick(
      hasRoleDashboardAccess(context, 'qc'),
      { label: 'کنترل کیفیت و NCR', href: '/dashboard/qc' },
      'کنترل کیفیت و NCR'
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'hse'),
      { label: 'HSE و نظارت تصویری', href: '/dashboard/hse' },
      'HSE و نظارت تصویری'
    ),
  ]

  const finance = [
    ...pick(
      pm || hasRoleDashboardAccess(context, 'accountant'),
      { label: 'هزینه‌های واقعی پروژه', href: '/finance/costs' },
      'هزینه‌های واقعی پروژه'
    ),
    ...pick(
      hasRoleDashboardAccess(context, 'accountant'),
      { label: 'صورت‌وضعیت‌های کارفرما', href: '/dashboard/accountant' },
      'صورت‌وضعیت‌های کارفرما'
    ),
  ]

  const groups: ManagerNavGroup[] = [
    { key: 'home', label: 'خانه', icon: 'home', href: '/dashboard/manager' },
    { key: 'alerts', label: 'همهٔ هشدارها', icon: 'alerts', href: '/dashboard/manager/alerts' },
  ]

  if (pm) {
    groups.push({
      key: 'inbox',
      label: 'کارتابل من',
      icon: 'inbox',
      href: '/site-ops/approvals',
      withProjectParam: true,
    })
  }
  if (schedule.length) {
    groups.push({ key: 'schedule', label: 'برنامه و پیشرفت', icon: 'schedule', children: schedule })
  }
  if (site.length) {
    groups.push({ key: 'site', label: 'اجرای کارگاه', icon: 'site', children: site })
  }
  if (quality.length) {
    groups.push({ key: 'quality', label: 'کیفیت و ایمنی', icon: 'quality', children: quality })
  }
  if (finance.length) {
    groups.push({ key: 'finance', label: 'مالی و هزینه‌ها', icon: 'finance', children: finance })
  }
  if (hasRoleDashboardAccess(context, 'project-manager') || has('finance_admin')) {
    groups.push({
      key: 'contracts',
      label: 'قراردادها و پیمانکاران',
      icon: 'contracts',
      href: '/project/subcontractors',
    })
  }
  groups.push({ key: 'reports', label: 'گزارش‌ها', icon: 'reports', href: '/reports' })
  groups.push({ key: 'background', label: 'بک‌گراند محاسبات', icon: 'background', href: '/dashboard/manager/background' })

  return { groups, unavailable }
}
