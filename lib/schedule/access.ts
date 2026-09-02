import type { DashboardUserContext } from '@/types/dashboard'
import type { SiteRoleKey } from '@/lib/dashboard/roles'

/** Position keys that grant access to each role dashboard. */
export const ROLE_DASHBOARD_ACCESS: Record<
  string,
  (SiteRoleKey | 'finance_admin' | 'site_manager')[]
> = {
  'site-supervisor': ['site_supervisor'],
  'project-manager': ['project_manager'],
  'technical-office': ['technical_office', 'site_supervisor'],
  storekeeper: ['storekeeper'],
  procurement: ['procurement_officer'],
  qc: ['qa_qc_inspector', 'site_supervisor'],
  hse: ['hse_officer'],
  security: ['security', 'project_manager', 'site_manager'],
  accountant: ['project_accountant', 'finance_admin'],
}

export function hasRoleDashboardAccess(
  context: DashboardUserContext,
  dashboardSlug: keyof typeof ROLE_DASHBOARD_ACCESS
): boolean {
  if (context.isSystemAdmin) return true
  const allowedKeys = ROLE_DASHBOARD_ACCESS[dashboardSlug] ?? []
  return allowedKeys.some((key) => context.positionKeys.includes(key))
}

export function hasAnyScheduleRole(context: DashboardUserContext): boolean {
  if (context.isSystemAdmin) return true
  const allKeys = Object.values(ROLE_DASHBOARD_ACCESS).flat()
  return allKeys.some((key) => context.positionKeys.includes(key))
}
