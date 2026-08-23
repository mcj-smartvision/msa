/** Maps construction role keys to live dashboard routes (admin + assigned members). */
export const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  project_manager: '/dashboard/project-manager',
  site_supervisor: '/dashboard/site-supervisor',
  technical_office: '/dashboard/technical-office',
  storekeeper: '/dashboard/storekeeper',
  procurement_officer: '/dashboard/procurement',
  qa_qc_inspector: '/dashboard/qc',
  hse_officer: '/dashboard/hse',
  security: '/dashboard/security',
  project_accountant: '/dashboard/accountant',
}

export function getRoleDashboardRoute(roleKey: string): string | null {
  if (roleKey === 'finance_admin') {
    return ROLE_DASHBOARD_ROUTES.project_accountant ?? null
  }
  if (roleKey === 'site_manager') {
    return ROLE_DASHBOARD_ROUTES.site_supervisor ?? null
  }
  return ROLE_DASHBOARD_ROUTES[roleKey] ?? null
}

export function memberWorkspaceHref(member: {
  id: string
  project_id: string
  positions?: Array<{ key: string }> | null
}): string {
  const primary = member.positions?.[0]
  const roleRoute = primary ? getRoleDashboardRoute(primary.key) : null
  if (roleRoute) {
    return `${roleRoute}?projectId=${encodeURIComponent(member.project_id)}`
  }
  return `/admin/projects/${member.project_id}/members/${member.id}`
}

export function hasLiveRoleDashboard(roleKey: string): boolean {
  return roleKey in ROLE_DASHBOARD_ROUTES
}
