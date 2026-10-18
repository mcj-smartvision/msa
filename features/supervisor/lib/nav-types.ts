/**
 * @file features/supervisor/lib/nav-types.ts
 * @purpose انواع ناوبری داشبورد سرپرست کارگاه
 * @safe-to-edit YES
 * @affects SupervisorWorkspaceShell, SupervisorMobileNav
 * @depends-on nothing
 */

export type SupervisorNavId =
  | 'safety'
  | 'overview'
  | 'workshop'
  | 'drawings'
  | 'inspection'
  | 'today'
  | 'daily-progress'
  | 'daily-report'
  | 'weekly-commitments'
  | 'weekly-rnc'
  | 'report-background'
  | 'store'
  | 'holidays'
  | 'lookahead'
  | 'issues'
  | 'resources'
  | 'ai'

export type SupervisorNavItem = {
  id: SupervisorNavId
  label: string
  hint?: string
  badge?: number
  badgeTone?: 'danger' | 'neutral'
  badgeTitle?: string
}
