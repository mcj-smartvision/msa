import type { FormLocale } from '@/features/project-init/lib/i18n/types'

/** Format monetary values in Persian Rial (ریال). */
export function formatRial(amount: number, locale: FormLocale = 'fa'): string {
  const safe = Number.isFinite(amount) ? amount : 0
  const usePersian = locale === 'fa' || locale === 'ar'
  const formatted = new Intl.NumberFormat(usePersian ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(safe)
  return usePersian ? `${formatted} ریال` : `${formatted} Rial`
}
