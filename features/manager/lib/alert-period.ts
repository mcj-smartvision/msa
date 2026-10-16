/**
 * @file features/manager/lib/alert-period.ts
 * @purpose منطق دامنه — داشبورد مدیر پروژه و KPI (alert-period)
 * @safe-to-edit CAREFUL
 * @affects داشبورد مدیر پروژه و KPI
 * @depends-on features/manager/lib/overview-types, shared/lib/time/tehran
 */

import type { ManagerAlert, ManagerPeriod } from '@/features/manager/lib/overview-types';
import { tehranPeriodStartMs } from '@/shared/lib/time/tehran';

export const MANAGER_PERIODS: { id: ManagerPeriod; label: string }[] = [
  { id: 'today', label: 'امروز' },
  { id: 'week', label: 'هفتهٔ جاری' },
  { id: 'month', label: 'ماه جاری' },
]

/** Start of today, of the Iranian week (Saturday) or of the current Jalali month, in Tehran time. */
export function periodStartMs(period: ManagerPeriod, now = new Date()): number {
  return tehranPeriodStartMs(period, now.getTime())
}

/**
 * Records of an event alert raised inside the period. Active alerts are never hidden by the
 * period — a crisis raised last month is still a crisis today — the period only marks what is new.
 */
export function newInPeriod(alert: ManagerAlert, period: ManagerPeriod, now = new Date()): number {
  if (!alert.eventBased) return 0
  const since = periodStartMs(period, now)
  return alert.items.filter((i) => i.occurredAt && new Date(i.occurredAt).getTime() >= since).length
}
