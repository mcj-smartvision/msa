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

/**
 * Live catalog proxy — each property read uses the current active locale.
 * Nested plain objects are also proxied so module-level captures like
 * `const labels = COPY.status` still resolve at access time.
 * Arrays and primitives are returned as-is (do not snapshot them at module load).
 */
export function liveMessages<T extends object>(resolve: (locale: FormLocale) => T): T {
  const wrap = (getNode: () => unknown): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          const node = getNode()
          if (node == null || (typeof node !== 'object' && typeof node !== 'function')) return undefined
          const value = Reflect.get(node as object, prop)
          if (typeof value === 'function') return value.bind(node)
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return wrap(() => Reflect.get(getNode() as object, prop))
          }
          return value
        },
      }
    )
  return wrap(() => resolve(getActiveLocale())) as T
}
