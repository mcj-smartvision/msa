/**
 * @file shared/lib/i18n/pick-messages.ts
 * @purpose انتخاب کاتالوگ پیام بر اساس locale (fa / en / de)
 * @safe-to-edit YES
 * @affects shared/lib/i18n get*Messages helpers
 * @depends-on features/project-init/lib/i18n/types, features/project-init/lib/i18n/utils
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'

export function pickMessages<T>(
  locale: FormLocale | string | undefined,
  catalogs: { en: T; fa: T; de?: T }
): T {
  const loc = normalizeLocale(locale)
  if (loc === 'fa') return catalogs.fa
  if (loc === 'de') return catalogs.de ?? catalogs.en
  return catalogs.en
}

export function isFaLocale(locale: FormLocale | string | undefined): boolean {
  return normalizeLocale(locale) === 'fa'
}
