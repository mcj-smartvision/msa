/**
 * @file shared/lib/i18n/make-live-copy.ts
 * @purpose ساخت کاتالوگ زنده FA/EN/DE
 * @safe-to-edit YES
 * @affects manager/supervisor copy exports
 * @depends-on shared/lib/i18n/active-locale, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getActiveLocale, liveMessages } from '@/shared/lib/i18n/active-locale'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

export function makeLiveCopy<T extends object>(catalogs: { fa: T; en: T; de?: T }): T {
  return liveMessages((locale: FormLocale) =>
    pickMessages(locale ?? getActiveLocale(), {
      fa: catalogs.fa,
      en: catalogs.en,
      de: catalogs.de ?? catalogs.en,
    })
  )
}
