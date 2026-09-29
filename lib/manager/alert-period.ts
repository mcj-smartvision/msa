import { toGregorian, toJalaali } from 'jalaali-js'
import type { ManagerAlert, ManagerPeriod } from '@/lib/manager/overview-types'

export const MANAGER_PERIODS: { id: ManagerPeriod; label: string }[] = [
  { id: 'today', label: 'امروز' },
  { id: 'week', label: 'هفتهٔ جاری' },
  { id: 'month', label: 'ماه جاری' },
]

/** Start of today, of the Iranian week (Saturday) or of the current Jalali month, local time. */
export function periodStartMs(period: ManagerPeriod, now = new Date()): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 1) % 7))
  } else if (period === 'month') {
    const { jy, jm } = toJalaali(start.getFullYear(), start.getMonth() + 1, start.getDate())
    const g = toGregorian(jy, jm, 1)
    return new Date(g.gy, g.gm - 1, g.gd).getTime()
  }
  return start.getTime()
}

/**
 * Records of an event alert raised inside the period. Active alerts are never hidden by the
 * period — a crisis raised last month is still a crisis today — the period only marks what is new.
 */
export function newInPeriod(alert: ManagerAlert, period: ManagerPeriod): number {
  if (!alert.eventBased) return 0
  const since = periodStartMs(period)
  return alert.items.filter((i) => i.occurredAt && new Date(i.occurredAt).getTime() >= since).length
}
