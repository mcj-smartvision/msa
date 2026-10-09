import type { FormLocale } from '@/features/project-init/lib/i18n/types'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Convert Persian/Arabic-Indic digits to ASCII 0-9. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch)
    if (p >= 0) return String(p)
    const a = ARABIC_DIGITS.indexOf(ch)
    return a >= 0 ? String(a) : ch
  })
}

/** Keep only digits (and at most one decimal point) from a typed money string. */
export function sanitizeMoneyDigits(raw: string, allowDecimals = false): string {
  const ascii = toAsciiDigits(raw)
  if (!allowDecimals) {
    return ascii.replace(/\D/g, '')
  }
  let out = ''
  let seenDot = false
  for (const ch of ascii) {
    if (ch >= '0' && ch <= '9') out += ch
    else if ((ch === '.' || ch === ',') && !seenDot) {
      // Treat first comma/dot as decimal only when allowDecimals
      if (ch === '.') {
        out += '.'
        seenDot = true
      }
    }
  }
  return out
}

/** Parse a formatted money string (with thousand separators) to a number. */
export function parseMoneyInput(raw: string): number {
  const digits = sanitizeMoneyDigits(raw, false)
  if (!digits) return NaN
  return Number(digits)
}

/**
 * Format digits with thousand separators while typing.
 * FA/AR → Persian digits + ٬   |   EN → Western digits + ,
 */
export function formatMoneyInput(raw: string, locale: FormLocale = 'fa'): string {
  const digits = sanitizeMoneyDigits(raw, false)
  if (!digits) return ''
  const n = Number(digits)
  if (!Number.isFinite(n)) return ''
  const usePersian = locale === 'fa' || locale === 'ar'
  return new Intl.NumberFormat(usePersian ? 'fa-IR-u-nu-latn' : 'en-US', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(n)
}

/** Format a known numeric amount for an input field. */
export function formatMoneyFromNumber(amount: number, locale: FormLocale = 'fa'): string {
  if (!Number.isFinite(amount)) return ''
  return formatMoneyInput(String(Math.round(Math.abs(amount))), locale)
}
