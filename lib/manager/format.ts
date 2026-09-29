import { formatScheduleDate } from '@/lib/schedule/dates'

export function faNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('fa-IR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function faPercent(value: number, fractionDigits = 1): string {
  return `${faNumber(value, fractionDigits)}٪`
}

/** Short Toman amount for cards (e.g. «۱٫۲ میلیارد تومان»); the exact value belongs in detail pages. */
export function compactToman(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs >= 1e9) return `${sign}${faNumber(abs / 1e9, 1)} میلیارد تومان`
  if (abs >= 1e6) return `${sign}${faNumber(abs / 1e6, 1)} میلیون تومان`
  return `${sign}${faNumber(abs)} تومان`
}

/** Latin digits (and decimal point between digits) to Persian, for server-built strings. */
export function faDigits(text: string): string {
  return text.replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

/** Compact Toman split into number and unit, so cards can size them separately. */
export function compactTomanParts(value: number): { value: string; unit: string } {
  const abs = Math.abs(value)
  if (abs >= 1e9) return { value: faNumber(abs / 1e9, 1), unit: 'میلیارد تومان' }
  if (abs >= 1e6) return { value: faNumber(abs / 1e6, 1), unit: 'میلیون تومان' }
  return { value: faNumber(abs), unit: 'تومان' }
}

export function jalaliDate(value: string | null | undefined): string {
  if (!value) return '—'
  return faDigits(formatScheduleDate(value, 'jalali'))
}

export function jalaliMonthLabel(isoMonth: string): string {
  const date = new Date(`${isoMonth.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoMonth
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short', year: '2-digit' }).format(date)
}

export function jalaliDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function relativeTimeFa(value: string | null, now = Date.now()): string | null {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  const minutes = Math.round((now - time) / 60000)
  if (minutes < 1) return 'همین حالا'
  if (minutes < 60) return `${faNumber(minutes)} دقیقه پیش`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${faNumber(hours)} ساعت پیش`
  const days = Math.round(hours / 24)
  if (days < 30) return `${faNumber(days)} روز پیش`
  return jalaliDate(value)
}
