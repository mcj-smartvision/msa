/** Weekday name for an ISO date string (local calendar day). */

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']
const WEEKDAY_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export function getInvoiceWeekday(
  isoDate: string | null | undefined,
  locale: 'fa' | 'en' = 'fa'
): string {
  if (!isoDate) return '—'
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  const idx = d.getDay()
  return locale === 'fa' ? WEEKDAY_FA[idx] : WEEKDAY_EN[idx]
}

export function formatInvoiceNumber(value: number, locale: 'fa' | 'en' = 'fa'): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}
