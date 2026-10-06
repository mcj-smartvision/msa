import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'

export const LOCALE_COOKIE = 'sitepilot_locale'

export function readLocaleCookie(): FormLocale {
  if (typeof document === 'undefined') return 'fa'
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  return normalizeLocale(match?.[1] ? decodeURIComponent(match[1]) : undefined)
}

export function writeLocaleCookie(locale: FormLocale) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)};path=/;max-age=${maxAge};SameSite=Lax`
  try {
    localStorage.setItem(LOCALE_COOKIE, locale)
  } catch {
    /* ignore storage errors */
  }
}

export function readStoredLocale(): FormLocale | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const fromStorage = localStorage.getItem(LOCALE_COOKIE)
    if (fromStorage) return normalizeLocale(fromStorage)
  } catch {
    /* ignore */
  }
  return readLocaleCookie()
}
