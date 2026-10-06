/** Convert a non-negative integer to Persian words (for invoice "مبلغ به حروف"). */

const ONES = [
  '',
  'یک',
  'دو',
  'سه',
  'چهار',
  'پنج',
  'شش',
  'هفت',
  'هشت',
  'نه',
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
]

const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']

const HUNDREDS = [
  '',
  'صد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
]

const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون']

function underThousand(n: number): string {
  if (n <= 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return o ? `${TENS[t]} و ${ONES[o]}` : TENS[t]
  }
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (!rest) return HUNDREDS[h]
  return `${HUNDREDS[h]} و ${underThousand(rest)}`
}

/** Integer amount → Persian words (no currency suffix). */
export function numberToPersianWords(amount: number): string {
  const n = Math.floor(Math.abs(Number.isFinite(amount) ? amount : 0))
  if (n === 0) return 'صفر'

  const parts: string[] = []
  let remaining = n
  let scale = 0

  while (remaining > 0 && scale < SCALES.length) {
    const chunk = remaining % 1000
    if (chunk > 0) {
      const chunkWords = underThousand(chunk)
      const scaleWord = SCALES[scale]
      parts.unshift(scaleWord ? `${chunkWords} ${scaleWord}` : chunkWords)
    }
    remaining = Math.floor(remaining / 1000)
    scale++
  }

  return parts.join(' و ')
}

/** Rial amount → "… ریال" in words. */
export function rialAmountToPersianWords(rial: number): string {
  return `${numberToPersianWords(rial)} ریال`
}

/** Toman amount → "… تومان" in words. */
export function tomanAmountToPersianWords(toman: number): string {
  return `${numberToPersianWords(toman)} تومان`
}

/** Convert stored Rial to Toman for classic Iranian invoice display. */
export function rialToToman(rial: number): number {
  const safe = Number.isFinite(rial) ? rial : 0
  return Math.round(safe / 10)
}
