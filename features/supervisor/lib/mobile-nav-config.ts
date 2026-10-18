/**
 * @file features/supervisor/lib/mobile-nav-config.ts
 * @purpose تب‌های اصلی ناوبری موبایل داشبورد سرپرست
 * @safe-to-edit YES
 * @affects SupervisorWorkspaceShell
 * @depends-on nothing
 */

/** Primary bottom-bar destinations on phone (reporting-first). */
export const SUPERVISOR_MOBILE_PRIMARY_IDS = [
  'daily-progress',
  'daily-report',
  'safety',
] as const

export type SupervisorMobilePrimaryId = (typeof SUPERVISOR_MOBILE_PRIMARY_IDS)[number]

export function isSupervisorMobilePrimary(id: string): id is SupervisorMobilePrimaryId {
  return (SUPERVISOR_MOBILE_PRIMARY_IDS as readonly string[]).includes(id)
}
