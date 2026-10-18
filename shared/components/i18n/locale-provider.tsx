/**
 * @file shared/components/i18n/locale-provider.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (locale-provider)
 * @safe-to-edit YES
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/lib/i18n/app-shell, shared/lib/i18n/locale-cookie, features/project-init/lib/i18n/types, features/project-init/lib/i18n/utils
 */

'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { APP_SHELL } from '@/shared/lib/i18n/app-shell'
import { setActiveLocale } from '@/shared/lib/i18n/active-locale'
import { LOCALE_COOKIE, readStoredLocale, writeLocaleCookie } from '@/shared/lib/i18n/locale-cookie'
import type { FormLocale } from '@/features/project-init/lib/i18n/types'
import { isRtlLocale, normalizeLocale } from '@/features/project-init/lib/i18n/utils'

interface LocaleContextValue {
  locale: FormLocale
  dir: 'ltr' | 'rtl'
  setLocale: (locale: FormLocale) => void
  app: (typeof APP_SHELL)[FormLocale]
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: string
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<FormLocale>(() =>
    normalizeLocale(initialLocale ?? (typeof window !== 'undefined' ? readStoredLocale() : undefined))
  )

  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr'

  const setLocale = useCallback(
    (next: FormLocale) => {
      const normalized = normalizeLocale(next)
      setActiveLocale(normalized)
      setLocaleState(normalized)
      writeLocaleCookie(normalized)
      document.documentElement.lang = normalized
      document.documentElement.dir = isRtlLocale(normalized) ? 'rtl' : 'ltr'
      router.refresh()
    },
    [router]
  )

  useEffect(() => {
    setActiveLocale(locale)
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      setLocale,
      app: APP_SHELL[locale],
    }),
    [locale, dir, setLocale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

export function useLocaleSafe() {
  const ctx = useContext(LocaleContext)
  if (ctx) return ctx
  const locale: FormLocale = 'fa'
  return {
    locale,
    dir: 'rtl' as const,
    setLocale: () => {},
    app: APP_SHELL[locale],
  }
}

export { LOCALE_COOKIE }
