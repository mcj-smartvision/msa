import type { DashboardUserContext } from '@/types/dashboard'
import { SITE_ROLE_LABELS, type SiteRoleKey } from '@/lib/dashboard/roles'

export interface RoleNavLink {
  href: string
  label: string
  roleKey: SiteRoleKey
}

const ROLE_DASHBOARD_PATHS: Partial<Record<SiteRoleKey | 'finance_admin', string>> = {
  project_manager: '/dashboard/project-manager',
  site_supervisor: '/dashboard/site-supervisor',
  technical_office: '/dashboard/technical-office',
  storekeeper: '/dashboard/storekeeper',
  procurement_officer: '/dashboard/procurement',
  qa_qc_inspector: '/dashboard/qc',
  hse_officer: '/dashboard/hse',
  security: '/dashboard/security',
  client: '/dashboard',
  project_accountant: '/dashboard/accountant',
  finance_admin: '/dashboard/accountant',
}

/** Navigation links visible in header based on assigned position keys. */
export function getRoleNavLinks(context: DashboardUserContext): RoleNavLink[] {
  const links: RoleNavLink[] = []
  const seen = new Set<string>()

  if (context.isSystemAdmin || context.positionKeys.includes('project_manager')) {
    seen.add('/dashboard/manager')
    links.push({ href: '/dashboard/manager', label: 'مدیر', roleKey: 'project_manager' })
  }

  for (const key of context.positionKeys) {
    const roleKey = key as SiteRoleKey
    const href = ROLE_DASHBOARD_PATHS[roleKey]
    if (!href || seen.has(href) || roleKey === 'client') continue
    seen.add(href)
    links.push({
      href,
      label: SITE_ROLE_LABELS[roleKey] ?? roleKey,
      roleKey,
    })
  }

  if (
    (context.isSystemAdmin || context.positionKeys.includes('site_supervisor')) &&
    !seen.has('/dashboard/qc')
  ) {
    seen.add('/dashboard/qc')
    links.push({
      href: '/dashboard/qc',
      label: SITE_ROLE_LABELS.qa_qc_inspector,
      roleKey: 'qa_qc_inspector',
    })
  }

  // Project Manager also gets subcontractors registry
  if (
    (context.isSystemAdmin || context.positionKeys.includes('project_manager')) &&
    !seen.has('/project/subcontractors')
  ) {
    links.push({
      href: '/project/subcontractors',
      label: 'پیمانکاران جزء',
      roleKey: 'project_manager',
    })
  }

  // Layer 2 Site Ops — PM approvals only (workshop ops live under Technical Office dashboard)
  if (
    (context.isSystemAdmin || context.positionKeys.includes('project_manager')) &&
    !seen.has('/site-ops/approvals')
  ) {
    links.push({
      href: '/site-ops/approvals',
      label: 'تأییدات کارگاه',
      roleKey: 'project_manager',
    })
  }

  // Schedule Intelligence — deterministic CPM dashboard (no AI)
  if (
    (context.isSystemAdmin ||
      context.positionKeys.includes('project_manager') ||
      context.positionKeys.includes('technical_office')) &&
    !seen.has('/dashboard/schedule-intelligence')
  ) {
    links.push({
      href: '/dashboard/schedule-intelligence',
      label: 'تحلیل زمان‌بندی',
      roleKey: 'project_manager',
    })
    seen.add('/dashboard/schedule-intelligence')
  }

  return links
}
