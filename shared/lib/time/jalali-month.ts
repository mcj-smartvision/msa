import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

/** Saturday first, as on Iranian calendars. */
export const PERSIAN_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const

const GREGORIAN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return `${gy}-${pad2(gm)}-${pad2(gd)}`
}

export function isoToJalali(iso: string): { jy: number; jm: number; jd: number } {
  const [gy, gm, gd] = iso.split('-').map(Number)
  return toJalaali(gy!, gm!, gd!)
}

/** «۱۵ مهر ۱۴۰۵» */
export function formatJalaliLong(iso: string): string {
  const { jy, jm, jd } = isoToJalali(iso)
  return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`
}

/** «۱۴۰۵/۰۷/۱۵» */
export function formatJalaliShort(iso: string): string {
  const { jy, jm, jd } = isoToJalali(iso)
  return toPersianDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`)
}

export function shiftJalaliMonth(jy: number, jm: number, by: number): { jy: number; jm: number } {
  const index = jy * 12 + (jm - 1) + by
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 }
}

export interface JalaliDayCell {
  iso: string
  jd: number
  /** Gregorian day of month, and its month name on the 1st or the first cell. */
  gd: number
  gMonth: string | null
  /** 0 = Saturday … 6 = Friday. */
  weekday: number
}

/** One Jalali month as calendar rows of seven (Saturday first), padded with nulls. */
export function jalaliMonthWeeks(jy: number, jm: number): (JalaliDayCell | null)[][] {
  const days: JalaliDayCell[] = []
  for (let jd = 1; jd <= jalaaliMonthLength(jy, jm); jd++) {
    const iso = jalaliToIso(jy, jm, jd)
    const g = new Date(`${iso}T00:00:00Z`)
    const gd = g.getUTCDate()
    days.push({
      iso,
      jd,
      gd,
      gMonth: gd === 1 || jd === 1 ? GREGORIAN_MONTHS[g.getUTCMonth()]! : null,
      weekday: (g.getUTCDay() + 1) % 7,
    })
  }
  const cells: (JalaliDayCell | null)[] = [...Array<null>(days[0]!.weekday).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  const weeks: (JalaliDayCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** «Sep – Oct 2026» for the Gregorian months a Jalali month spans. */
export function gregorianSpanLabel(jy: number, jm: number): string {
  const first = new Date(`${jalaliToIso(jy, jm, 1)}T00:00:00Z`)
  const last = new Date(`${jalaliToIso(jy, jm, jalaaliMonthLength(jy, jm))}T00:00:00Z`)
  const a = `${GREGORIAN_MONTHS[first.getUTCMonth()]}${first.getUTCFullYear() !== last.getUTCFullYear() ? ` ${first.getUTCFullYear()}` : ''}`
  return `${a} – ${GREGORIAN_MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`
}
