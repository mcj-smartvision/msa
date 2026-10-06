/** WBS hierarchy helpers for schedule table indentation. */

export function wbsDepth(wbsCode: string | null | undefined): number {
  if (!wbsCode?.trim()) return 0
  return wbsCode.split('.').filter(Boolean).length - 1
}

export function wbsSortKey(wbsCode: string | null | undefined, fallback = ''): string {
  if (!wbsCode?.trim()) return fallback
  return wbsCode
    .split('.')
    .map((part) => part.padStart(6, '0'))
    .join('.')
}

export function compareWbs(a: string | null | undefined, b: string | null | undefined): number {
  return wbsSortKey(a).localeCompare(wbsSortKey(b))
}

/** True when `childWbs` is under `parentWbs` (4.1 / 4.1.2 under 4, not 40 under 4). */
export function isWbsDescendant(
  childWbs: string | null | undefined,
  parentWbs: string | null | undefined
): boolean {
  const child = childWbs?.trim()
  const parent = parentWbs?.trim()
  if (!child || !parent) return false
  return child.startsWith(`${parent}.`)
}

const EASTERN_DIGITS = /[۰-۹٠-٩]/g
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function toLatinDigits(value: string): string {
  return value.replace(EASTERN_DIGITS, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch)
    if (p >= 0) return String(p)
    const a = ARABIC_DIGITS.indexOf(ch)
    return a >= 0 ? String(a) : ch
  })
}

/**
 * Display-only: drop leading WBS numbers from activity names
 * (e.g. "۱. تحویل زمین" / "4.1 آرماتور…") when a WBS column already shows the code.
 */
export function displayActivityName(
  name: string | null | undefined,
  wbs?: string | null
): string {
  const raw = String(name ?? '').trim()
  if (!raw) return ''

  let cleaned = raw
  const wbsTrim = wbs?.trim()
  if (wbsTrim) {
    const wbsLatin = toLatinDigits(wbsTrim)
    const nameLatin = toLatinDigits(cleaned)
    if (
      nameLatin === wbsLatin ||
      nameLatin.startsWith(`${wbsLatin} `) ||
      nameLatin.startsWith(`${wbsLatin}.`) ||
      nameLatin.startsWith(`${wbsLatin}\u200c`)
    ) {
      // Strip same length of leading tokens matching wbs pattern from original
      cleaned = cleaned.replace(
        /^[\d۰-۹٠-٩]+(?:[.\u200c\u00a0\s]*[\d۰-۹٠-٩]+)*[.\u200c\u00a0\s\-–—]*/u,
        ''
      )
    }
  }

  cleaned = cleaned
    .replace(/^[\d۰-۹٠-٩]+(?:\.[\d۰-۹٠-٩]+)*\.?[.\u200c\u00a0\s\-–—]+/u, '')
    .trim()

  return cleaned || raw
}
