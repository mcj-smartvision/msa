import { SiteOpsError } from './errors'

export const SITE_OPS_ROLES = [
  'PROJECT_CONTROLS',
  'PLANNER',
  'SITE_MANAGER',
  'SUPERVISOR',
  'TECHNICAL_OFFICE',
  'PM',
  'HSE',
  'WAREHOUSE',
  'GUARD',
  'VIEWER',
] as const

export type SiteOpsRole = (typeof SITE_OPS_ROLES)[number]

export type SiteOpsAction =
  | 'cre.import'
  | 'cre.view'
  | 'cre.promote'
  | 'cre.force_promote'
  | 'plan.draft'
  | 'plan.issue'
  | 'plan.lock'
  | 'plan.close'
  | 'work_order.write'
  | 'actual.submit'
  | 'actual.approve'
  | 'blocker.write'
  | 'package.enrich'
  | 'package.decompose'
  | 'package.payment_flag'
  | 'package.payment_ready_from_incomplete'
  | 'package.status'
  | 'exception.view'
  | 'exception.acknowledge'
  | 'report.view'
  | 'safety.write'
  | 'warehouse.write'
  | 'guard.write'

const ROLE_ACTIONS: Record<SiteOpsRole, SiteOpsAction[]> = {
  PROJECT_CONTROLS: [
    'cre.import',
    'cre.view',
    'cre.promote',
    'cre.force_promote',
    'plan.draft',
    'plan.issue',
    'work_order.write',
    'report.view',
    'exception.view',
    'package.enrich',
  ],
  PLANNER: [
    'cre.import',
    'cre.view',
    'cre.promote',
    'plan.draft',
    'work_order.write',
    'report.view',
    'package.enrich',
  ],
  SITE_MANAGER: [
    'cre.import',
    'cre.view',
    'cre.promote',
    'cre.force_promote',
    'plan.draft',
    'plan.issue',
    'plan.lock',
    'plan.close',
    'work_order.write',
    'actual.approve',
    'blocker.write',
    'report.view',
    'exception.view',
    'exception.acknowledge',
    'package.status',
  ],
  PM: [
    'cre.view',
    'report.view',
    'exception.view',
    'exception.acknowledge',
    'actual.approve',
    'plan.issue',
    'package.payment_ready_from_incomplete',
  ],
  SUPERVISOR: [
    'cre.view',
    'plan.draft',
    'work_order.write',
    'actual.submit',
    'actual.approve',
    'blocker.write',
    'package.status',
    'report.view',
  ],
  TECHNICAL_OFFICE: [
    'cre.view',
    'cre.import',
    'cre.promote',
    'package.enrich',
    'package.decompose',
    'package.payment_flag',
    'package.payment_ready_from_incomplete',
    'package.status',
    'exception.view',
    'report.view',
  ],
  HSE: ['cre.view', 'safety.write', 'report.view'],
  WAREHOUSE: ['cre.view', 'warehouse.write', 'report.view'],
  GUARD: ['cre.view', 'guard.write', 'report.view'],
  VIEWER: ['cre.view', 'report.view', 'exception.view'],
}

/** Map Liparta position keys → default site-ops roles. */
export function mapSitePilotPositionToSiteOpsRoles(positionKeys: string[]): SiteOpsRole[] {
  const roles = new Set<SiteOpsRole>()
  for (const key of positionKeys) {
    switch (key) {
      case 'project_manager':
        roles.add('PM')
        roles.add('SITE_MANAGER')
        roles.add('PROJECT_CONTROLS')
        break
      case 'site_supervisor':
      case 'site_manager':
      case 'foreman':
        roles.add('SUPERVISOR')
        break
      case 'technical_office':
      case 'planning_engineer':
      case 'civil_engineer':
        roles.add('TECHNICAL_OFFICE')
        break
      case 'hse_officer':
        roles.add('HSE')
        break
      case 'storekeeper':
        roles.add('WAREHOUSE')
        break
      case 'security':
        roles.add('GUARD')
        break
      case 'procurement_officer':
      case 'qa_qc_inspector':
      case 'project_accountant':
      case 'client':
        roles.add('VIEWER')
        break
      default:
        break
    }
  }
  return [...roles]
}

export function canPerform(roles: SiteOpsRole[], action: SiteOpsAction): boolean {
  return roles.some((role) => ROLE_ACTIONS[role]?.includes(action))
}

export function assertPermission(roles: SiteOpsRole[], action: SiteOpsAction): void {
  if (!canPerform(roles, action)) {
    throw new SiteOpsError('FORBIDDEN', `Role cannot perform action: ${action}`)
  }
}
