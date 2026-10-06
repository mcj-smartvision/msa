import type { DashboardUserContext } from '@/shared/types/dashboard'

export const ACCOUNTANT_DESKTOP_PATH = '/dashboard/accountant'
export const ACCOUNTANT_MOBILE_PATH = '/accountant-app'
export const ACCOUNTANT_SHELL_CHOICE_PATH = '/choose-accountant-shell'

/** Project accountant / finance admin — ask mobile vs Windows after login. */
export function shouldAskAccountantShell(context: DashboardUserContext): boolean {
  if (context.isSystemAdmin) return false
  return (
    context.positionKeys.includes('project_accountant') ||
    context.positionKeys.includes('finance_admin')
  )
}
