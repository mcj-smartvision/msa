import type { HolidayRule } from '@/features/holidays/lib/types'

/** Whether a civil day (YYYY-MM-DD) is a working day. */
export type IsWorkday = (iso: string) => boolean

export const everyDayWorks: IsWorkday = () => true

const DAY_MS = 86_400_000
/** Longest run of days off a calendar may have; guards against a calendar with no working day. */
const MAX_DAYS_OFF = 400

const shiftDay = (iso: string, by: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10)

/** 0 = Saturday … 6 = Friday. */
export const persianWeekday = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 1) % 7

/** The day itself when it works, else the next working day. */
export function nextWorkday(iso: string, isWorkday: IsWorkday): string {
  let d = iso
  for (let i = 0; i < MAX_DAYS_OFF && !isWorkday(d); i++) d = shiftDay(d, 1)
  return d
}

/** Moves `n` working days (negative = back); each step lands on a working day. 0 returns the day itself. */
export function addWorkdays(iso: string, n: number, isWorkday: IsWorkday): string {
  const step = n < 0 ? -1 : 1
  let d = iso
  for (let left = Math.abs(n); left > 0; left--) {
    let guard = 0
    do d = shiftDay(d, step)
    while (!isWorkday(d) && ++guard < MAX_DAYS_OFF)
  }
  return d
}

/** Signed working days from `from` to `to`: those in (from, to] when later, minus those in (to, from] when earlier. */
export function diffWorkdays(from: string, to: string, isWorkday: IsWorkday): number {
  if (from === to) return 0
  const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1]
  let count = 0
  for (let d = shiftDay(a, 1); d <= b; d = shiftDay(d, 1)) if (isWorkday(d)) count++
  return sign * count
}

/** Working days from `start` to `finish`, both included. */
export function countWorkdays(start: string, finish: string, isWorkday: IsWorkday): number {
  let count = 0
  for (let d = start; d <= finish; d = shiftDay(d, 1)) if (isWorkday(d)) count++
  return count
}

/** Active holidays covering a day: a dated holiday spans start…end; a weekly one repeats on its start's weekday. */
export function holidaysOn<T extends HolidayRule>(holidays: T[], iso: string): T[] {
  return holidays.filter((h) => {
    if (!h.isActive || iso < h.startDate) return false
    if (h.type === 'weekly') return (!h.endDate || iso <= h.endDate) && persianWeekday(iso) === persianWeekday(h.startDate)
    return iso <= (h.endDate ?? h.startDate)
  })
}

/** Site calendar: Friday is always off, and so is every day an active holiday covers. */
export function siteWorkCalendar(holidays: HolidayRule[]): IsWorkday {
  const active = holidays.filter((h) => h.isActive)
  const memo = new Map<string, boolean>()
  return (iso) => {
    let works = memo.get(iso)
    if (works === undefined) {
      works = persianWeekday(iso) !== 6 && holidaysOn(active, iso).length === 0
      memo.set(iso, works)
    }
    return works
  }
}
