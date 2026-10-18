/**
 * @file features/manager/lib/i18n/make-live-copy.ts
 * @purpose ساخت کاتالوگ زنده FA/EN/DE برای بلوک‌های کپی مدیر
 * @safe-to-edit YES
 * @affects features/manager/lib/ui-copy exports
 * @depends-on shared/lib/i18n/active-locale, shared/lib/i18n/pick-messages
 */

import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { getActiveLocale, liveMessages } from '@/shared/lib/i18n/active-locale'
import { pickMessages } from '@/shared/lib/i18n/pick-messages'

export function makeLiveCopy<T extends object>(catalogs: { fa: T; en: T; de: T }): T {
  const resolve = (locale: FormLocale) => pickMessages(locale, catalogs)
  return liveMessages((locale) => resolve(locale ?? getActiveLocale()))
}
