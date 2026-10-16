/**
 * @file features/admin/lib/role-dashboard-routes.ts
 * @purpose منطق دامنه — کنترل سنتر و مدیریت اعضا/پروژه (role-dashboard-routes)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on nothing
 */

export const ROLE_DASHBOARD_ORDER = [
  'project_manager',
  'site_supervisor',
  'hse_officer',
  'technical_office',
  'security',
  'storekeeper',
  'procurement_officer',
  'qa_qc_inspector',
  'project_accountant',
] as const

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

export type RoleDashboardGroup<T extends { positions?: Array<{ key: string }> | null }> = {
  roleKey: string
  href: string
  members: T[]
}

/** Members bucketed by the live dashboard of their assigned position. */
export function groupMembersByRoleDashboard<T extends { positions?: Array<{ key: string }> | null }>(
  members: T[]
): RoleDashboardGroup<T>[] {
  const byHref = new Map<string, T[]>()
  for (const member of members) {
    const seen = new Set<string>()
    for (const position of member.positions ?? []) {
      const href = getRoleDashboardRoute(position.key)
      if (!href || seen.has(href)) continue
      seen.add(href)
      const bucket = byHref.get(href)
      if (bucket) bucket.push(member)
      else byHref.set(href, [member])
    }
  }

  return Object.keys(ROLE_DASHBOARD_ROUTES)
    .sort((a, b) => {
      const ia = ROLE_DASHBOARD_ORDER.indexOf(a as (typeof ROLE_DASHBOARD_ORDER)[number])
      const ib = ROLE_DASHBOARD_ORDER.indexOf(b as (typeof ROLE_DASHBOARD_ORDER)[number])
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    .map((roleKey) => ({
      roleKey,
      href: ROLE_DASHBOARD_ROUTES[roleKey]!,
      members: byHref.get(ROLE_DASHBOARD_ROUTES[roleKey]!) ?? [],
    }))
}
