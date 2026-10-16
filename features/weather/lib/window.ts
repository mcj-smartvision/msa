/**
 * @file features/weather/lib/window.ts
 * @purpose منطق دامنه — هوای کارگاه (window)
 * @safe-to-edit CAREFUL
 * @affects هوای کارگاه
 * @depends-on shared/lib/time/tehran
 */

import { tehranDateIso, tehranMidnight, todayTehranIso } from '@/shared/lib/time/tehran'

const DAY_MS = 86_400_000

export function shiftTehranIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return tehranDateIso(tehranMidnight(year!, month!, day!) + days * DAY_MS)
}

/** 7 days before today through 7 days after (15 dates). */
export function weatherDateWindow(today = todayTehranIso()): string[] {
  return Array.from({ length: 15 }, (_, i) => shiftTehranIso(today, i - 7))
}

export function dayKind(iso: string, today = todayTehranIso()): 'past' | 'today' | 'future' {
  if (iso === today) return 'today'
  return iso < today ? 'past' : 'future'
}
