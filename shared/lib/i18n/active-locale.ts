/**
 * @file shared/lib/i18n/active-locale.ts
 * @purpose locale فعال برای کاتالوگ‌های پیام در سطح ماژول
 * @safe-to-edit YES
 * @affects get*Messages fallbacks, LocaleProvider
 * @depends-on features/project-init/lib/i18n/types, features/project-init/lib/i18n/utils
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { normalizeLocale } from '@/features/project-init/lib/i18n/utils'

let activeLocale: FormLocale = 'fa'

export function setActiveLocale(locale: FormLocale | string | undefined) {
  activeLocale = normalizeLocale(locale)
}

export function getActiveLocale(): FormLocale {
  return activeLocale
}

/** Live catalog proxy — each property read uses the current active locale. */
export function liveMessages<T extends object>(resolve: (locale: FormLocale) => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const catalog = resolve(getActiveLocale())
      const value = Reflect.get(catalog, prop, receiver)
      return typeof value === 'function' ? value.bind(catalog) : value
    },
  })
}
